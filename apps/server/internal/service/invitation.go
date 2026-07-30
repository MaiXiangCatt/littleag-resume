package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"math/big"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/google/uuid"
	"golang.org/x/text/unicode/norm"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
)

const (
	defaultInvitationTTL      = 30 * time.Minute
	defaultInvitationCooldown = 30 * time.Minute
	invitationCodeLength      = 16
)

const invitationAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

type InvitationChallenge struct {
	ID     string
	Prompt string
	Answer string
}

type RegistrationPolicy struct {
	Mode               model.RegistrationMode
	ChallengeAvailable bool
}

type InvitationChallengePayload struct {
	ChallengeID string
	Prompt      string
}

type InvitationCodePayload struct {
	InvitationCode string
	ExpiresIn      time.Duration
}

type InvitationServiceConfig struct {
	Mode        model.RegistrationMode
	Challenges  []InvitationChallenge
	Invitations repository.RegistrationInvitationRepository
	TTL         time.Duration
	Cooldown    time.Duration
	Now         func() time.Time
	Random      io.Reader
}

type InvitationService struct {
	mode        model.RegistrationMode
	challenges  []InvitationChallenge
	byID        map[string]InvitationChallenge
	invitations repository.RegistrationInvitationRepository
	ttl         time.Duration
	cooldown    time.Duration
	now         func() time.Time
	random      io.Reader
	cooldownMu  sync.Mutex
	issuedUntil map[string]time.Time
}

func NewInvitationService(config InvitationServiceConfig) *InvitationService {
	if config.Mode == "" {
		config.Mode = model.RegistrationModeOpen
	}
	if config.TTL <= 0 {
		config.TTL = defaultInvitationTTL
	}
	if config.Cooldown <= 0 {
		config.Cooldown = defaultInvitationCooldown
	}
	if config.Now == nil {
		config.Now = func() time.Time { return time.Now().UTC() }
	}
	if config.Random == nil {
		config.Random = rand.Reader
	}

	challenges := append([]InvitationChallenge(nil), config.Challenges...)
	byID := make(map[string]InvitationChallenge, len(challenges))
	for _, challenge := range challenges {
		byID[challenge.ID] = challenge
	}
	return &InvitationService{
		mode:        config.Mode,
		challenges:  challenges,
		byID:        byID,
		invitations: config.Invitations,
		ttl:         config.TTL,
		cooldown:    config.Cooldown,
		now:         config.Now,
		random:      config.Random,
		issuedUntil: make(map[string]time.Time),
	}
}

func (s *InvitationService) Policy() RegistrationPolicy {
	return RegistrationPolicy{
		Mode:               s.mode,
		ChallengeAvailable: s.mode != model.RegistrationModeClosed && len(s.challenges) > 0,
	}
}

func (s *InvitationService) RandomChallenge() (*InvitationChallengePayload, error) {
	if !s.Policy().ChallengeAvailable {
		return nil, model.ErrRegistrationClosed
	}
	index, err := rand.Int(s.random, big.NewInt(int64(len(s.challenges))))
	if err != nil {
		return nil, model.ErrInternalServer
	}
	challenge := s.challenges[index.Int64()]
	return &InvitationChallengePayload{
		ChallengeID: challenge.ID,
		Prompt:      challenge.Prompt,
	}, nil
}

func (s *InvitationService) AnswerChallenge(
	ctx context.Context,
	clientIP, challengeID, answer string,
) (*InvitationCodePayload, error) {
	if !s.Policy().ChallengeAvailable {
		return nil, model.ErrRegistrationClosed
	}
	challenge, exists := s.byID[strings.TrimSpace(challengeID)]
	if !exists || normalizeInvitationAnswer(answer) != normalizeInvitationAnswer(challenge.Answer) {
		return nil, model.ErrInvitationAnswerWrong
	}
	if s.invitations == nil {
		return nil, model.ErrDBError
	}

	now := s.now()
	s.cooldownMu.Lock()
	defer s.cooldownMu.Unlock()
	s.cleanupCooldowns(now)
	if issuedUntil, exists := s.issuedUntil[clientIP]; exists && issuedUntil.After(now) {
		return nil, model.ErrTooManyRequests
	}

	code, err := newRegistrationInvitationCode(s.random)
	if err != nil {
		return nil, model.ErrInternalServer
	}
	codeHash, ok := registrationInvitationCodeHash(code)
	if !ok {
		return nil, model.ErrInternalServer
	}
	invitation := &model.RegistrationInvitation{
		ID:        uuid.New(),
		CodeHash:  codeHash,
		ExpiresAt: now.Add(s.ttl),
		CreatedAt: now,
	}
	if err := s.invitations.CreateRegistrationInvitation(ctx, invitation); err != nil {
		return nil, model.ErrDBError
	}
	s.issuedUntil[clientIP] = now.Add(s.cooldown)
	return &InvitationCodePayload{
		InvitationCode: code,
		ExpiresIn:      s.ttl,
	}, nil
}

func (s *InvitationService) cleanupCooldowns(now time.Time) {
	for clientIP, expiresAt := range s.issuedUntil {
		if !expiresAt.After(now) {
			delete(s.issuedUntil, clientIP)
		}
	}
}

func normalizeInvitationAnswer(value string) string {
	value = strings.ToLower(norm.NFKC.String(value))
	var builder strings.Builder
	builder.Grow(len(value))
	for _, character := range value {
		if unicode.IsSpace(character) || unicode.IsPunct(character) {
			continue
		}
		builder.WriteRune(character)
	}
	return builder.String()
}

func newRegistrationInvitationCode(random io.Reader) (string, error) {
	raw := make([]byte, invitationCodeLength)
	if _, err := io.ReadFull(random, raw); err != nil {
		return "", err
	}
	characters := make([]byte, invitationCodeLength)
	for index, value := range raw {
		characters[index] = invitationAlphabet[int(value)%len(invitationAlphabet)]
	}
	return fmt.Sprintf(
		"%s-%s-%s-%s",
		characters[0:4],
		characters[4:8],
		characters[8:12],
		characters[12:16],
	), nil
}

func registrationInvitationCodeHash(value string) (string, bool) {
	normalized := normalizeRegistrationInvitationCode(value)
	if len(normalized) != invitationCodeLength {
		return "", false
	}
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:]), true
}

func normalizeRegistrationInvitationCode(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	var builder strings.Builder
	builder.Grow(len(value))
	for _, character := range value {
		if character == '-' || unicode.IsSpace(character) {
			continue
		}
		builder.WriteRune(character)
	}
	return builder.String()
}
