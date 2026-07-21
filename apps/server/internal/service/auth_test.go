package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/service"
)

func newTestAuthService(t *testing.T) (*service.AuthService, *repository.MemoryStore) {
	t.Helper()

	store := repository.NewMemoryStore()
	auth := service.NewAuthService(service.AuthServiceConfig{
		Users:            store,
		RefreshTokens:    store,
		AccessTokenKey:   []byte("test-access-secret-with-enough-length"),
		AccessTokenTTL:   15 * time.Minute,
		RefreshTokenTTL:  7 * 24 * time.Hour,
		AccountLockLimit: 5,
		AccountLockTTL:   15 * time.Minute,
	})
	return auth, store
}

func TestAuthServiceRegisterValidationAndDuplicates(t *testing.T) {
	ctx := context.Background()
	auth, store := newTestAuthService(t)

	_, _, err := auth.Register(ctx, service.RegisterInput{
		Username:        "!",
		Email:           "bad@example.com",
		Password:        "password1",
		ConfirmPassword: "password1",
	})
	if !errors.Is(err, model.ErrUsernameFormatInvalid) {
		t.Fatalf("expected username format error, got %v", err)
	}

	_, _, err = auth.Register(ctx, service.RegisterInput{
		Username:        "zhangsan",
		Email:           "user@example.com",
		Password:        "short",
		ConfirmPassword: "short",
	})
	if !errors.Is(err, model.ErrPasswordTooWeak) {
		t.Fatalf("expected weak password error, got %v", err)
	}

	result, refreshToken, err := auth.Register(ctx, service.RegisterInput{
		Username:        "zhangsan",
		Email:           "User@Example.com",
		Password:        "password1",
		ConfirmPassword: "password1",
	})
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	if result.AccessToken == "" || refreshToken == "" {
		t.Fatalf("expected issued tokens")
	}
	if result.User.Email != "User@Example.com" || result.User.Username != "zhangsan" {
		t.Fatalf("unexpected user payload: %+v", result.User)
	}

	user, err := store.FindActiveUserByEmailNormalized(ctx, "user@example.com")
	if err != nil {
		t.Fatalf("expected normalized email lookup: %v", err)
	}
	if user.PasswordHash == "password1" || user.PasswordHash == "" {
		t.Fatalf("password must be stored as a non-empty hash")
	}

	_, _, err = auth.Register(ctx, service.RegisterInput{
		Username:        "lisi",
		Email:           "user@example.com",
		Password:        "password1",
		ConfirmPassword: "password1",
	})
	if !errors.Is(err, model.ErrEmailExists) {
		t.Fatalf("expected duplicate email error, got %v", err)
	}

	_, _, err = auth.Register(ctx, service.RegisterInput{
		Username:        "zhangsan",
		Email:           "other@example.com",
		Password:        "password1",
		ConfirmPassword: "password1",
	})
	if !errors.Is(err, model.ErrUsernameExists) {
		t.Fatalf("expected duplicate username error, got %v", err)
	}
}

func TestAuthServiceLoginTokenRefreshAndLogout(t *testing.T) {
	ctx := context.Background()
	auth, _ := newTestAuthService(t)

	registered, firstRefresh, err := auth.Register(ctx, service.RegisterInput{
		Username:        "zhangsan",
		Email:           "user@example.com",
		Password:        "password1",
		ConfirmPassword: "password1",
	})
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	user, err := auth.ValidateAccessToken(ctx, registered.AccessToken)
	if err != nil {
		t.Fatalf("access token should validate: %v", err)
	}
	if user.Email != "user@example.com" {
		t.Fatalf("unexpected token user: %+v", user)
	}

	_, _, err = auth.Login(ctx, service.LoginInput{
		Email:    "user@example.com",
		Password: "wrong-password",
	})
	if !errors.Is(err, model.ErrInvalidCredential) {
		t.Fatalf("expected invalid credential, got %v", err)
	}

	loggedIn, secondRefresh, err := auth.Login(ctx, service.LoginInput{
		Email:    "USER@example.com",
		Password: "password1",
	})
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if loggedIn.User.ID != registered.User.ID || secondRefresh == firstRefresh {
		t.Fatalf("expected same user and a fresh refresh token")
	}

	refreshed, thirdRefresh, err := auth.Refresh(ctx, secondRefresh)
	if err != nil {
		t.Fatalf("refresh failed: %v", err)
	}
	if refreshed.AccessToken == "" || thirdRefresh == "" || thirdRefresh == secondRefresh {
		t.Fatalf("expected rotated refresh token and new access token")
	}

	_, _, err = auth.Refresh(ctx, secondRefresh)
	if !errors.Is(err, model.ErrRefreshTokenInvalid) {
		t.Fatalf("expected reused refresh token to be invalid, got %v", err)
	}

	if err := auth.Logout(ctx, thirdRefresh); err != nil {
		t.Fatalf("logout failed: %v", err)
	}
	_, _, err = auth.Refresh(ctx, thirdRefresh)
	if !errors.Is(err, model.ErrRefreshTokenInvalid) {
		t.Fatalf("expected logged-out refresh token to be invalid, got %v", err)
	}
}

func TestAuthServiceRefreshPreservesDatabaseErrors(t *testing.T) {
	store := repository.NewMemoryStore()
	databaseFailure := errors.New("database unavailable")
	auth := service.NewAuthService(service.AuthServiceConfig{
		Users:            store,
		RefreshTokens:    failingRefreshRepository{err: databaseFailure},
		AccessTokenKey:   []byte("test-access-secret-with-enough-length"),
		AccessTokenTTL:   15 * time.Minute,
		RefreshTokenTTL:  7 * 24 * time.Hour,
		AccountLockLimit: 5,
		AccountLockTTL:   15 * time.Minute,
	})

	_, _, err := auth.Refresh(context.Background(), "refresh-token")
	if !errors.Is(err, model.ErrDBError) {
		t.Fatalf("expected database error, got %v", err)
	}
}

type failingRefreshRepository struct {
	err error
}

func (r failingRefreshRepository) CreateRefreshToken(context.Context, *model.RefreshToken) error {
	return r.err
}

func (r failingRefreshRepository) FindActiveRefreshTokenByHash(context.Context, string) (*model.RefreshToken, error) {
	return nil, r.err
}

func (r failingRefreshRepository) RevokeRefreshToken(context.Context, uuid.UUID, *uuid.UUID, time.Time) error {
	return r.err
}

func (r failingRefreshRepository) RotateRefreshToken(context.Context, uuid.UUID, *model.RefreshToken, time.Time) error {
	return r.err
}

func TestAuthServiceAccountLockout(t *testing.T) {
	ctx := context.Background()
	auth, _ := newTestAuthService(t)

	_, _, err := auth.Register(ctx, service.RegisterInput{
		Username:        "zhangsan",
		Email:           "user@example.com",
		Password:        "password1",
		ConfirmPassword: "password1",
	})
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	for attempt := 1; attempt <= 4; attempt++ {
		_, _, err = auth.Login(ctx, service.LoginInput{
			Email:    "USER@example.com",
			Password: "wrong-password",
		})
		if !errors.Is(err, model.ErrInvalidCredential) {
			t.Fatalf("attempt %d expected invalid credential, got %v", attempt, err)
		}
	}

	_, _, err = auth.Login(ctx, service.LoginInput{
		Email:    "user@example.com",
		Password: "wrong-password",
	})
	if !errors.Is(err, model.ErrAccountLocked) {
		t.Fatalf("fifth failed login should lock account, got %v", err)
	}

	_, _, err = auth.Login(ctx, service.LoginInput{
		Email:    "user@example.com",
		Password: "password1",
	})
	if !errors.Is(err, model.ErrAccountLocked) {
		t.Fatalf("locked account should reject even correct password, got %v", err)
	}
}
