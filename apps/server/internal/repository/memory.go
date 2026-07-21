package repository

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
)

type MemoryStore struct {
	mu            sync.RWMutex
	users         map[uuid.UUID]*model.User
	refreshTokens map[uuid.UUID]*model.RefreshToken
	resumes       map[uuid.UUID]*model.Resume
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		users:         map[uuid.UUID]*model.User{},
		refreshTokens: map[uuid.UUID]*model.RefreshToken{},
		resumes:       map[uuid.UUID]*model.Resume{},
	}
}

func (s *MemoryStore) CreateResume(_ context.Context, resume *model.Resume) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	copy := cloneResume(resume)
	now := time.Now().UTC()
	if copy.CreatedAt.IsZero() {
		copy.CreatedAt = now
	}
	if copy.UpdatedAt.IsZero() {
		copy.UpdatedAt = now
	}
	s.resumes[copy.ID] = copy
	return nil
}

func (s *MemoryStore) FindResumeByID(_ context.Context, userID, resumeID uuid.UUID) (*model.Resume, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	resume, ok := s.resumes[resumeID]
	if !ok || resume.UserID != userID || resume.DeletedAt.Valid {
		return nil, ErrNotFound
	}
	return cloneResume(resume), nil
}

func (s *MemoryStore) ListResumes(_ context.Context, userID uuid.UUID, options ResumeListOptions) ([]model.Resume, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := make([]model.Resume, 0)
	needle := strings.ToLower(options.Query)
	for _, resume := range s.resumes {
		if resume.UserID != userID || resume.DeletedAt.Valid {
			continue
		}
		if needle != "" && !strings.Contains(strings.ToLower(resume.Title), needle) {
			continue
		}
		if options.Status != "" && resume.Status != options.Status {
			continue
		}
		items = append(items, *cloneResume(resume))
	}
	sort.SliceStable(items, func(i, j int) bool {
		switch options.Sort {
		case "updated_asc":
			return items[i].UpdatedAt.Before(items[j].UpdatedAt)
		case "created_desc":
			return items[i].CreatedAt.After(items[j].CreatedAt)
		case "title_asc":
			return strings.ToLower(items[i].Title) < strings.ToLower(items[j].Title)
		default:
			return items[i].UpdatedAt.After(items[j].UpdatedAt)
		}
	})
	total := len(items)
	start := options.Offset
	if start > total {
		start = total
	}
	end := start + options.Limit
	if end > total {
		end = total
	}
	return items[start:end], total, nil
}

func (s *MemoryStore) UpdateResume(_ context.Context, resume *model.Resume) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	existing, ok := s.resumes[resume.ID]
	if !ok || existing.UserID != resume.UserID || existing.DeletedAt.Valid {
		return ErrNotFound
	}
	copy := cloneResume(resume)
	copy.UpdatedAt = time.Now().UTC()
	s.resumes[copy.ID] = copy
	resume.UpdatedAt = copy.UpdatedAt
	return nil
}

func (s *MemoryStore) DeleteResume(_ context.Context, userID, resumeID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	resume, ok := s.resumes[resumeID]
	if !ok || resume.UserID != userID || resume.DeletedAt.Valid {
		return ErrNotFound
	}
	resume.DeletedAt.Time = time.Now().UTC()
	resume.DeletedAt.Valid = true
	return nil
}

func (s *MemoryStore) GetResumeStats(_ context.Context, userID uuid.UUID) (ResumeStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	stats := ResumeStats{}
	for _, resume := range s.resumes {
		if resume.UserID != userID || resume.DeletedAt.Valid {
			continue
		}
		stats.Total++
		stats.Exported += resume.ExportCount
		if resume.Status == model.ResumeStatusCompleted {
			stats.Completed++
		} else {
			stats.Draft++
		}
	}
	return stats, nil
}

func cloneResume(resume *model.Resume) *model.Resume {
	copy := *resume
	copy.ContentJSON = append(model.JSONDocument(nil), resume.ContentJSON...)
	if resume.TemplateID != nil {
		templateID := *resume.TemplateID
		copy.TemplateID = &templateID
	}
	return &copy
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
