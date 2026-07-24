package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
)

const printTokenBytes = 32

type printGrant struct {
	userID    uuid.UUID
	resumeID  uuid.UUID
	expiresAt time.Time
}

// PrintTokenService issues short-lived opaque grants for exactly one print-data
// request. Only token hashes are retained in memory.
type PrintTokenService struct {
	mu     sync.Mutex
	grants map[[sha256.Size]byte]printGrant
	ttl    time.Duration
	now    func() time.Time
}

func NewPrintTokenService(ttl time.Duration) *PrintTokenService {
	if ttl <= 0 {
		ttl = 90 * time.Second
	}
	return &PrintTokenService{
		grants: make(map[[sha256.Size]byte]printGrant),
		ttl:    ttl,
		now:    time.Now,
	}
}

func (s *PrintTokenService) Issue(userID, resumeID uuid.UUID) (string, error) {
	rawToken := make([]byte, printTokenBytes)
	if _, err := rand.Read(rawToken); err != nil {
		return "", model.ErrInternalServer
	}
	token := base64.RawURLEncoding.EncodeToString(rawToken)
	now := s.now()
	tokenHash := sha256.Sum256([]byte(token))

	s.mu.Lock()
	defer s.mu.Unlock()
	s.deleteExpiredLocked(now)
	s.grants[tokenHash] = printGrant{
		userID:    userID,
		resumeID:  resumeID,
		expiresAt: now.Add(s.ttl),
	}
	return token, nil
}

func (s *PrintTokenService) Consume(token string) (userID, resumeID uuid.UUID, err error) {
	if token == "" {
		return uuid.Nil, uuid.Nil, model.ErrTokenInvalid
	}
	tokenHash := sha256.Sum256([]byte(token))
	now := s.now()

	s.mu.Lock()
	defer s.mu.Unlock()
	grant, ok := s.grants[tokenHash]
	if !ok {
		return uuid.Nil, uuid.Nil, model.ErrTokenInvalid
	}
	delete(s.grants, tokenHash)
	if !grant.expiresAt.After(now) {
		return uuid.Nil, uuid.Nil, model.ErrTokenExpired
	}
	return grant.userID, grant.resumeID, nil
}

func (s *PrintTokenService) deleteExpiredLocked(now time.Time) {
	for tokenHash, grant := range s.grants {
		if !grant.expiresAt.After(now) {
			delete(s.grants, tokenHash)
		}
	}
}
