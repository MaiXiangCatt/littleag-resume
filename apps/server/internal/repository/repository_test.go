package repository_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

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

func TestMemoryRefreshTokenRotationIsAtomic(t *testing.T) {
	ctx := context.Background()
	store := repository.NewMemoryStore()
	userID := uuid.New()
	oldToken := &model.RefreshToken{
		ID:        uuid.New(),
		UserID:    userID,
		TokenHash: "shared-old-hash",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if err := store.CreateRefreshToken(ctx, oldToken); err != nil {
		t.Fatalf("create old token: %v", err)
	}

	start := make(chan struct{})
	results := make(chan error, 2)
	var ready sync.WaitGroup
	ready.Add(2)
	for i := 0; i < 2; i++ {
		replacement := &model.RefreshToken{
			ID:        uuid.New(),
			UserID:    userID,
			TokenHash: "replacement-" + uuid.NewString(),
			ExpiresAt: time.Now().Add(time.Hour),
		}
		go func() {
			ready.Done()
			<-start
			results <- store.RotateRefreshToken(ctx, oldToken.ID, replacement, time.Now())
		}()
	}
	ready.Wait()
	close(start)

	successes := 0
	notFound := 0
	for i := 0; i < 2; i++ {
		err := <-results
		switch {
		case err == nil:
			successes++
		case errors.Is(err, repository.ErrNotFound):
			notFound++
		default:
			t.Fatalf("unexpected rotation error: %v", err)
		}
	}
	if successes != 1 || notFound != 1 {
		t.Fatalf("expected one success and one consumed-token failure, got success=%d notFound=%d", successes, notFound)
	}
}

func TestGormMigrationDefinesAuthPersistenceConstraints(t *testing.T) {
	db := openTestGormStore(t)
	migrator := db.Migrator()

	for _, table := range []any{&model.User{}, &model.RefreshToken{}} {
		if !migrator.HasTable(table) {
			t.Fatalf("expected table for %T", table)
		}
	}
	for _, index := range []string{
		"users_email_active_uidx",
		"users_username_active_uidx",
		"idx_refresh_tokens_token_hash",
		"idx_refresh_tokens_user_id",
	} {
		if !migrator.HasIndex(&model.RefreshToken{}, index) && !migrator.HasIndex(&model.User{}, index) {
			t.Fatalf("expected migrated index %q", index)
		}
	}
}

func TestGormRepositoryPersistsAuthRecords(t *testing.T) {
	ctx := context.Background()
	db := openTestGormStore(t)
	store := repository.NewGormStore(db)

	user := &model.User{
		ID:              uuid.New(),
		Username:        "wangwu",
		Email:           "Wangwu@Example.com",
		EmailNormalized: "wangwu@example.com",
		PasswordHash:    "hash",
	}
	if err := store.CreateUser(ctx, user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	found, err := store.FindActiveUserByEmailNormalized(ctx, "wangwu@example.com")
	if err != nil {
		t.Fatalf("lookup user: %v", err)
	}
	if found.ID != user.ID || found.Username != "wangwu" {
		t.Fatalf("unexpected user: %+v", found)
	}

	if err := store.CreateUser(ctx, &model.User{
		ID:              uuid.New(),
		Username:        "other",
		Email:           "other@example.com",
		EmailNormalized: "wangwu@example.com",
		PasswordHash:    "hash",
	}); !errors.Is(err, repository.ErrDuplicateEmail) {
		t.Fatalf("expected duplicate email, got %v", err)
	}

	oldToken := &model.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: "gorm-old-hash",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if err := store.CreateRefreshToken(ctx, oldToken); err != nil {
		t.Fatalf("create token: %v", err)
	}
	newID := uuid.New()
	if err := store.RevokeRefreshToken(ctx, oldToken.ID, &newID, time.Now()); err != nil {
		t.Fatalf("revoke token: %v", err)
	}
	if _, err := store.FindActiveRefreshTokenByHash(ctx, "gorm-old-hash"); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("expected revoked token lookup to miss, got %v", err)
	}
}

func TestGormRefreshTokenRotationIsAtomic(t *testing.T) {
	ctx := context.Background()
	db := openTestGormStore(t)
	store := repository.NewGormStore(db)
	user := &model.User{
		ID:              uuid.New(),
		Username:        "rotate-user",
		Email:           "rotate@example.com",
		EmailNormalized: "rotate@example.com",
		PasswordHash:    "hash",
	}
	if err := store.CreateUser(ctx, user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	oldToken := &model.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: "gorm-shared-old-hash",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if err := store.CreateRefreshToken(ctx, oldToken); err != nil {
		t.Fatalf("create old token: %v", err)
	}

	firstReplacement := &model.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: "gorm-first-replacement",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if err := store.RotateRefreshToken(ctx, oldToken.ID, firstReplacement, time.Now()); err != nil {
		t.Fatalf("rotate token: %v", err)
	}

	secondReplacement := &model.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: "gorm-second-replacement",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if err := store.RotateRefreshToken(ctx, oldToken.ID, secondReplacement, time.Now()); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("expected consumed old token, got %v", err)
	}
	if _, err := store.FindActiveRefreshTokenByHash(ctx, secondReplacement.TokenHash); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("failed rotation must roll back replacement insert, got %v", err)
	}
	if _, err := store.FindActiveRefreshTokenByHash(ctx, firstReplacement.TokenHash); err != nil {
		t.Fatalf("successful replacement should remain active: %v", err)
	}
}

func openTestGormStore(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := repository.Migrate(ctxWithTestTimeout(t), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func ctxWithTestTimeout(t *testing.T) context.Context {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	t.Cleanup(cancel)
	return ctx
}
