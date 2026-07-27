package service_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/service"
)

type fakeVerificationEmailSender struct {
	mu    sync.Mutex
	codes map[string]string
	calls int
	err   error
}

func newFakeVerificationEmailSender() *fakeVerificationEmailSender {
	return &fakeVerificationEmailSender{codes: map[string]string{}}
}

func (s *fakeVerificationEmailSender) SendVerificationCode(
	_ context.Context,
	recipient, code string,
	_ time.Duration,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return s.err
	}
	s.codes[recipient] = code
	s.calls++
	return nil
}

func (s *fakeVerificationEmailSender) code(recipient string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.codes[recipient]
}

func newTestAuthService(
	t *testing.T,
) (*service.AuthService, *repository.MemoryStore, *fakeVerificationEmailSender) {
	t.Helper()

	store := repository.NewMemoryStore()
	sender := newFakeVerificationEmailSender()
	auth := service.NewAuthService(service.AuthServiceConfig{
		Users:                     store,
		EmailVerifications:        store,
		RegistrationVerifications: store,
		RefreshTokens:             store,
		VerificationEmailSender:   sender,
		EmailVerificationKey:      []byte("test-email-verification-key-with-enough-length"),
		EmailVerificationTTL:      10 * time.Minute,
		EmailVerificationLimit:    5,
		EmailResendCooldown:       time.Minute,
		AccessTokenKey:            []byte("test-access-secret-with-enough-length"),
		AccessTokenTTL:            15 * time.Minute,
		RefreshTokenTTL:           7 * 24 * time.Hour,
		AccountLockLimit:          5,
		AccountLockTTL:            15 * time.Minute,
	})
	return auth, store, sender
}

func sendCodeAndRegister(
	t *testing.T,
	auth *service.AuthService,
	sender *fakeVerificationEmailSender,
	username, email string,
) (*model.AuthPayload, string) {
	t.Helper()
	ctx := context.Background()
	if _, err := auth.SendRegistrationEmailVerification(ctx, email); err != nil {
		t.Fatalf("send verification failed: %v", err)
	}
	payload, refreshToken, err := auth.Register(ctx, service.RegisterInput{
		Username:         username,
		Email:            email,
		Password:         "password1",
		ConfirmPassword:  "password1",
		VerificationCode: sender.code(email),
	})
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	return payload, refreshToken
}

func TestAuthServiceRegistrationVerifiesEmailBeforeCreatingUser(t *testing.T) {
	ctx := context.Background()
	auth, store, sender := newTestAuthService(t)

	if _, err := auth.SendRegistrationEmailVerification(ctx, "not-an-email"); !errors.Is(
		err,
		model.ErrEmailFormatInvalid,
	) {
		t.Fatalf("expected email format error, got %v", err)
	}

	pending, err := auth.SendRegistrationEmailVerification(ctx, "User@Example.com")
	if err != nil {
		t.Fatalf("send verification failed: %v", err)
	}
	if pending.Email != "User@Example.com" || pending.ExpiresInSeconds != 600 {
		t.Fatalf("unexpected verification payload: %+v", pending)
	}
	if sender.code("User@Example.com") == "" {
		t.Fatal("verification email was not sent")
	}
	if _, err := store.FindActiveUserByEmailNormalized(ctx, "user@example.com"); !errors.Is(
		err,
		repository.ErrNotFound,
	) {
		t.Fatalf("sending a code must not create a user, got %v", err)
	}
	challenge, err := store.FindActiveRegistrationEmailVerification(ctx, "user@example.com")
	if err != nil {
		t.Fatalf("find verification challenge: %v", err)
	}
	if challenge.CodeMAC == sender.code("User@Example.com") || len(challenge.CodeMAC) != 64 {
		t.Fatalf("verification code must only be stored as an HMAC, got %q", challenge.CodeMAC)
	}
	result, refreshToken, err := auth.Register(ctx, service.RegisterInput{
		Username:         "zhangsan",
		Email:            "user@example.com",
		Password:         "password1",
		ConfirmPassword:  "password1",
		VerificationCode: sender.code("User@Example.com"),
	})
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	if result.AccessToken == "" || refreshToken == "" || !result.User.EmailVerified {
		t.Fatalf("expected verified session, got %+v", result)
	}
	user, err := store.FindActiveUserByEmailNormalized(ctx, "user@example.com")
	if err != nil || user.EmailVerifiedAt == nil {
		t.Fatalf("user should be verified, user=%+v err=%v", user, err)
	}
	if user.PasswordHash == "password1" || user.PasswordHash == "" {
		t.Fatal("password must be stored as a non-empty hash")
	}

	if _, err := auth.SendRegistrationEmailVerification(ctx, "user@example.com"); !errors.Is(
		err,
		model.ErrEmailExists,
	) {
		t.Fatalf("expected duplicate email error, got %v", err)
	}
}

func TestAuthServiceVerificationAttemptLimit(t *testing.T) {
	ctx := context.Background()
	auth, _, sender := newTestAuthService(t)
	if _, err := auth.SendRegistrationEmailVerification(ctx, "user@example.com"); err != nil {
		t.Fatalf("send verification failed: %v", err)
	}
	validCode := sender.code("user@example.com")
	for attempt := 0; attempt < 5; attempt++ {
		if _, _, err := auth.Register(ctx, service.RegisterInput{
			Username:         "zhangsan",
			Email:            "user@example.com",
			Password:         "password1",
			ConfirmPassword:  "password1",
			VerificationCode: "000000",
		}); !errors.Is(err, model.ErrVerificationInvalid) {
			t.Fatalf("attempt %d expected invalid verification code, got %v", attempt+1, err)
		}
	}
	if _, _, err := auth.Register(ctx, service.RegisterInput{
		Username:         "zhangsan",
		Email:            "user@example.com",
		Password:         "password1",
		ConfirmPassword:  "password1",
		VerificationCode: validCode,
	}); !errors.Is(err, model.ErrVerificationInvalid) {
		t.Fatalf("challenge should stay invalid after attempt limit, got %v", err)
	}
}

func TestAuthServiceResendHonorsCooldownAndInvalidatesOldCode(t *testing.T) {
	ctx := context.Background()
	store := repository.NewMemoryStore()
	sender := newFakeVerificationEmailSender()
	now := time.Date(2026, 7, 24, 12, 0, 0, 0, time.UTC)
	auth := service.NewAuthService(service.AuthServiceConfig{
		Users:                     store,
		EmailVerifications:        store,
		RegistrationVerifications: store,
		RefreshTokens:             store,
		VerificationEmailSender:   sender,
		EmailVerificationKey:      []byte("test-email-verification-key-with-enough-length"),
		EmailVerificationTTL:      10 * time.Minute,
		EmailResendCooldown:       time.Minute,
		AccessTokenKey:            []byte("test-access-secret-with-enough-length"),
		Now:                       func() time.Time { return now },
	})
	if _, err := auth.SendRegistrationEmailVerification(ctx, "user@example.com"); err != nil {
		t.Fatalf("send verification failed: %v", err)
	}
	oldCode := sender.code("user@example.com")
	if _, err := auth.SendRegistrationEmailVerification(ctx, "user@example.com"); err != nil {
		t.Fatalf("cooldown resend should return current challenge: %v", err)
	}
	if sender.calls != 1 {
		t.Fatalf("cooldown should not send again, calls=%d", sender.calls)
	}

	now = now.Add(61 * time.Second)
	if _, err := auth.SendRegistrationEmailVerification(ctx, "user@example.com"); err != nil {
		t.Fatalf("resend failed: %v", err)
	}
	if sender.calls != 2 {
		t.Fatalf("expected second email, calls=%d", sender.calls)
	}
	if _, _, err := auth.Register(ctx, service.RegisterInput{
		Username:         "zhangsan",
		Email:            "user@example.com",
		Password:         "password1",
		ConfirmPassword:  "password1",
		VerificationCode: oldCode,
	}); !errors.Is(err, model.ErrVerificationInvalid) {
		t.Fatalf("old code should be invalid, got %v", err)
	}
	if _, _, err := auth.Register(ctx, service.RegisterInput{
		Username:         "zhangsan",
		Email:            "user@example.com",
		Password:         "password1",
		ConfirmPassword:  "password1",
		VerificationCode: sender.code("user@example.com"),
	}); err != nil {
		t.Fatalf("new code should verify: %v", err)
	}
}

func TestAuthServiceLoginTokenRefreshAndLogout(t *testing.T) {
	ctx := context.Background()
	auth, _, sender := newTestAuthService(t)
	registered, firstRefresh := sendCodeAndRegister(t, auth, sender, "zhangsan", "user@example.com")

	user, err := auth.ValidateAccessToken(ctx, registered.AccessToken)
	if err != nil || !user.EmailVerified {
		t.Fatalf("access token should validate verified user: user=%+v err=%v", user, err)
	}
	if _, _, err = auth.Login(ctx, service.LoginInput{
		Email: "user@example.com", Password: "wrong-password",
	}); !errors.Is(err, model.ErrInvalidCredential) {
		t.Fatalf("expected invalid credential, got %v", err)
	}

	loggedIn, secondRefresh, err := auth.Login(ctx, service.LoginInput{
		Email: "USER@example.com", Password: "password1",
	})
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if loggedIn.User.ID != registered.User.ID || secondRefresh == firstRefresh {
		t.Fatal("expected same user and a fresh refresh token")
	}
	refreshed, thirdRefresh, err := auth.Refresh(ctx, secondRefresh)
	if err != nil || refreshed.AccessToken == "" || thirdRefresh == secondRefresh {
		t.Fatalf("expected rotated refresh token, refreshed=%+v err=%v", refreshed, err)
	}
	if _, _, err = auth.Refresh(ctx, secondRefresh); !errors.Is(err, model.ErrRefreshTokenInvalid) {
		t.Fatalf("reused refresh token should be invalid, got %v", err)
	}
	if err := auth.Logout(ctx, thirdRefresh); err != nil {
		t.Fatalf("logout failed: %v", err)
	}
}

func TestAuthServiceRefreshPreservesDatabaseErrors(t *testing.T) {
	store := repository.NewMemoryStore()
	databaseFailure := errors.New("database unavailable")
	auth := service.NewAuthService(service.AuthServiceConfig{
		Users:          store,
		RefreshTokens:  failingRefreshRepository{err: databaseFailure},
		AccessTokenKey: []byte("test-access-secret-with-enough-length"),
	})

	if _, _, err := auth.Refresh(context.Background(), "refresh-token"); !errors.Is(err, model.ErrDBError) {
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
	auth, _, sender := newTestAuthService(t)
	sendCodeAndRegister(t, auth, sender, "zhangsan", "user@example.com")

	for attempt := 1; attempt <= 4; attempt++ {
		if _, _, err := auth.Login(ctx, service.LoginInput{
			Email: "USER@example.com", Password: "wrong-password",
		}); !errors.Is(err, model.ErrInvalidCredential) {
			t.Fatalf("attempt %d expected invalid credential, got %v", attempt, err)
		}
	}
	if _, _, err := auth.Login(ctx, service.LoginInput{
		Email: "user@example.com", Password: "wrong-password",
	}); !errors.Is(err, model.ErrAccountLocked) {
		t.Fatalf("fifth failed login should lock account, got %v", err)
	}
	if _, _, err := auth.Login(ctx, service.LoginInput{
		Email: "user@example.com", Password: "password1",
	}); !errors.Is(err, model.ErrAccountLocked) {
		t.Fatalf("locked account should reject correct password, got %v", err)
	}
}

func TestAuthServiceLoginFailuresExpire(t *testing.T) {
	store := repository.NewMemoryStore()
	now := time.Date(2026, 7, 27, 12, 0, 0, 0, time.UTC)
	auth := service.NewAuthService(service.AuthServiceConfig{
		Users:                store,
		AccessTokenKey:       []byte("test-access-secret-with-enough-length"),
		AccountLockLimit:     2,
		AccountLockTTL:       15 * time.Minute,
		LoginFailureCapacity: 10,
		Now:                  func() time.Time { return now },
	})

	if _, _, err := auth.Login(context.Background(), service.LoginInput{
		Email: "missing@example.com", Password: "wrong-password",
	}); !errors.Is(err, model.ErrInvalidCredential) {
		t.Fatalf("first failure = %v", err)
	}
	now = now.Add(16 * time.Minute)
	if _, _, err := auth.Login(context.Background(), service.LoginInput{
		Email: "missing@example.com", Password: "wrong-password",
	}); !errors.Is(err, model.ErrInvalidCredential) {
		t.Fatalf("expired failure must not lock account, got %v", err)
	}
}

func TestAuthServiceLoginFailureMapRejectsNewEntriesAtCapacity(t *testing.T) {
	store := repository.NewMemoryStore()
	now := time.Date(2026, 7, 27, 12, 0, 0, 0, time.UTC)
	auth := service.NewAuthService(service.AuthServiceConfig{
		Users:                store,
		AccessTokenKey:       []byte("test-access-secret-with-enough-length"),
		AccountLockLimit:     2,
		AccountLockTTL:       15 * time.Minute,
		LoginFailureCapacity: 2,
		Now:                  func() time.Time { return now },
	})

	for _, email := range []string{"first@example.com", "second@example.com", "third@example.com"} {
		if _, _, err := auth.Login(context.Background(), service.LoginInput{
			Email: email, Password: "wrong-password",
		}); !errors.Is(err, model.ErrInvalidCredential) {
			t.Fatalf("failure for %s = %v", email, err)
		}
		now = now.Add(time.Second)
	}
	if _, _, err := auth.Login(context.Background(), service.LoginInput{
		Email: "first@example.com", Password: "wrong-password",
	}); !errors.Is(err, model.ErrAccountLocked) {
		t.Fatalf("existing failure state should be preserved at capacity, got %v", err)
	}
}
