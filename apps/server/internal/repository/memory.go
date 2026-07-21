package repository

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
)

type MemoryStore struct {
	mu            sync.RWMutex
	users         map[uuid.UUID]*model.User
	refreshTokens map[uuid.UUID]*model.RefreshToken
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		users:         map[uuid.UUID]*model.User{},
		refreshTokens: map[uuid.UUID]*model.RefreshToken{},
	}
}

func (s *MemoryStore) CreateUser(_ context.Context, user *model.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, existing := range s.users {
		if existing.DeletedAt != nil {
			continue
		}
		if existing.EmailNormalized == user.EmailNormalized {
			return ErrDuplicateEmail
		}
		if existing.Username == user.Username {
			return ErrDuplicateUsername
		}
	}

	now := time.Now().UTC()
	copy := *user
	if copy.CreatedAt.IsZero() {
		copy.CreatedAt = now
	}
	if copy.UpdatedAt.IsZero() {
		copy.UpdatedAt = now
	}
	s.users[copy.ID] = &copy
	return nil
}

func (s *MemoryStore) FindActiveUserByID(_ context.Context, id uuid.UUID) (*model.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, ok := s.users[id]
	if !ok || user.DeletedAt != nil {
		return nil, ErrNotFound
	}
	copy := *user
	return &copy, nil
}

func (s *MemoryStore) FindActiveUserByEmailNormalized(_ context.Context, emailNormalized string) (*model.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, user := range s.users {
		if user.DeletedAt == nil && user.EmailNormalized == emailNormalized {
			copy := *user
			return &copy, nil
		}
	}
	return nil, ErrNotFound
}

func (s *MemoryStore) FindActiveUserByUsername(_ context.Context, username string) (*model.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, user := range s.users {
		if user.DeletedAt == nil && user.Username == username {
			copy := *user
			return &copy, nil
		}
	}
	return nil, ErrNotFound
}

func (s *MemoryStore) CreateRefreshToken(_ context.Context, token *model.RefreshToken) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, existing := range s.refreshTokens {
		if existing.TokenHash == token.TokenHash {
			return ErrDuplicateUsername
		}
	}
	copy := *token
	if copy.CreatedAt.IsZero() {
		copy.CreatedAt = time.Now().UTC()
	}
	s.refreshTokens[copy.ID] = &copy
	return nil
}

func (s *MemoryStore) FindActiveRefreshTokenByHash(_ context.Context, tokenHash string) (*model.RefreshToken, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, token := range s.refreshTokens {
		if token.TokenHash == tokenHash && token.RevokedAt == nil {
			copy := *token
			return &copy, nil
		}
	}
	return nil, ErrNotFound
}

func (s *MemoryStore) RevokeRefreshToken(_ context.Context, id uuid.UUID, replacementID *uuid.UUID, revokedAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	token, ok := s.refreshTokens[id]
	if !ok {
		return ErrNotFound
	}
	token.RevokedAt = &revokedAt
	token.ReplacedByTokenID = replacementID
	return nil
}

func (s *MemoryStore) RotateRefreshToken(_ context.Context, id uuid.UUID, replacement *model.RefreshToken, revokedAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	current, ok := s.refreshTokens[id]
	if !ok || current.RevokedAt != nil {
		return ErrNotFound
	}
	for _, existing := range s.refreshTokens {
		if existing.TokenHash == replacement.TokenHash {
			return ErrDuplicateUsername
		}
	}

	replacementCopy := *replacement
	if replacementCopy.CreatedAt.IsZero() {
		replacementCopy.CreatedAt = time.Now().UTC()
	}
	s.refreshTokens[replacementCopy.ID] = &replacementCopy
	current.RevokedAt = &revokedAt
	current.ReplacedByTokenID = &replacementCopy.ID
	return nil
}
