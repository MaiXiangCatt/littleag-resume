package repository_test

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
)

func TestUserRepositoryEnforcesActiveUniqueEmailAndUsername(t *testing.T) {
	ctx := context.Background()
	store := repository.NewMemoryStore()

	user := &model.User{
		ID:              uuid.New(),
		Username:        "zhangsan",
		Email:           "User@Example.com",
		EmailNormalized: "user@example.com",
		PasswordHash:    "hash",
	}
	if err := store.CreateUser(ctx, user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	_, err := store.FindActiveUserByEmailNormalized(ctx, "user@example.com")
	if err != nil {
		t.Fatalf("lookup normalized email: %v", err)
	}

	err = store.CreateUser(ctx, &model.User{
		ID:              uuid.New(),
		Username:        "lisi",
		Email:           "USER@example.com",
		EmailNormalized: "user@example.com",
		PasswordHash:    "hash",
	})
	if !errors.Is(err, repository.ErrDuplicateEmail) {
		t.Fatalf("expected duplicate email, got %v", err)
	}

	err = store.CreateUser(ctx, &model.User{
		ID:              uuid.New(),
		Username:        "zhangsan",
		Email:           "other@example.com",
		EmailNormalized: "other@example.com",
		PasswordHash:    "hash",
	})
	if !errors.Is(err, repository.ErrDuplicateUsername) {
		t.Fatalf("expected duplicate username, got %v", err)
	}
}

func TestRefreshTokenRepositoryLookupRevokeAndReplacement(t *testing.T) {
	ctx := context.Background()
	store := repository.NewMemoryStore()
	userID := uuid.New()
	oldID := uuid.New()
	newID := uuid.New()

	oldToken := &model.RefreshToken{
		ID:        oldID,
		UserID:    userID,
		TokenHash: "old-hash",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if err := store.CreateRefreshToken(ctx, oldToken); err != nil {
		t.Fatalf("create old token: %v", err)
	}
	if _, err := store.FindActiveRefreshTokenByHash(ctx, "old-hash"); err != nil {
		t.Fatalf("lookup old token: %v", err)
	}

	replacement := &model.RefreshToken{
		ID:        newID,
		UserID:    userID,
		TokenHash: "new-hash",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if err := store.CreateRefreshToken(ctx, replacement); err != nil {
		t.Fatalf("create replacement token: %v", err)
	}
	if err := store.RevokeRefreshToken(ctx, oldID, &newID, time.Now()); err != nil {
		t.Fatalf("revoke old token: %v", err)
	}

	_, err := store.FindActiveRefreshTokenByHash(ctx, "old-hash")
	if !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("expected revoked token lookup to miss, got %v", err)
	}
	if _, err := store.FindActiveRefreshTokenByHash(ctx, "new-hash"); err != nil {
		t.Fatalf("replacement token should be active: %v", err)
	}
}

func TestPostgresMigrationsDefineAuthPersistenceConstraints(t *testing.T) {
	content, err := os.ReadFile("../../migrations/001_auth.sql")
	if err != nil {
		t.Fatalf("read migration: %v", err)
	}
	migration := string(content)

	for _, expected := range []string{
		"CREATE TABLE IF NOT EXISTS users",
		"CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uidx",
		"WHERE deleted_at IS NULL",
		"CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_uidx",
		"CREATE TABLE IF NOT EXISTS refresh_tokens",
		"token_hash TEXT NOT NULL UNIQUE",
		"replaced_by_token_id UUID NULL",
	} {
		if !strings.Contains(migration, expected) {
			t.Fatalf("migration must contain %q", expected)
		}
	}
}
