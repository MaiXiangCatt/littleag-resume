package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
)

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_\p{Han}-]{2,32}$`)

type RegisterInput struct {
	Username        string
	Email           string
	Password        string
	ConfirmPassword string
}

type LoginInput struct {
	Email    string
	Password string
}

type AuthServiceConfig struct {
	Users            repository.UserRepository
	RefreshTokens    repository.RefreshTokenRepository
	AccessTokenKey   []byte
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	AccountLockLimit int
	AccountLockTTL   time.Duration
	Now              func() time.Time
}

type AuthService struct {
	users        repository.UserRepository
	refresh      repository.RefreshTokenRepository
	accessKey    []byte
	accessTTL    time.Duration
	refreshTTL   time.Duration
	lockLimit    int
	lockTTL      time.Duration
	now          func() time.Time
	lockMu       sync.Mutex
	loginFailure map[string]loginFailure
}

type loginFailure struct {
	count       int
	lockedUntil time.Time
}

type accessClaims struct {
	jwt.RegisteredClaims
}

func NewAuthService(config AuthServiceConfig) *AuthService {
	if config.AccessTokenTTL == 0 {
		config.AccessTokenTTL = 15 * time.Minute
	}
	if config.RefreshTokenTTL == 0 {
		config.RefreshTokenTTL = 7 * 24 * time.Hour
	}
	if config.AccountLockLimit == 0 {
		config.AccountLockLimit = 5
	}
	if config.AccountLockTTL == 0 {
		config.AccountLockTTL = 15 * time.Minute
	}
	if config.Now == nil {
		config.Now = func() time.Time { return time.Now().UTC() }
	}
	return &AuthService{
		users:        config.Users,
		refresh:      config.RefreshTokens,
		accessKey:    config.AccessTokenKey,
		accessTTL:    config.AccessTokenTTL,
		refreshTTL:   config.RefreshTokenTTL,
		lockLimit:    config.AccountLockLimit,
		lockTTL:      config.AccountLockTTL,
		now:          config.Now,
		loginFailure: map[string]loginFailure{},
	}
}

func (s *AuthService) Register(ctx context.Context, input RegisterInput) (*model.AuthPayload, string, error) {
	if err := validateRegister(input); err != nil {
		return nil, "", err
	}

	emailNormalized := normalizeEmail(input.Email)
	if _, err := s.users.FindActiveUserByEmailNormalized(ctx, emailNormalized); err == nil {
		return nil, "", model.ErrEmailExists
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, "", model.ErrDBError
	}
	if _, err := s.users.FindActiveUserByUsername(ctx, input.Username); err == nil {
		return nil, "", model.ErrUsernameExists
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, "", model.ErrDBError
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", model.ErrInternalServer
	}

	now := s.now()
	user := &model.User{
		ID:              uuid.New(),
		Username:        input.Username,
		Email:           strings.TrimSpace(input.Email),
		EmailNormalized: emailNormalized,
		PasswordHash:    string(passwordHash),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.users.CreateUser(ctx, user); err != nil {
		if errors.Is(err, repository.ErrDuplicateEmail) {
			return nil, "", model.ErrEmailExists
		}
		if errors.Is(err, repository.ErrDuplicateUsername) {
			return nil, "", model.ErrUsernameExists
		}
		return nil, "", model.ErrDBError
	}

	return s.issueSession(ctx, user)
}

func (s *AuthService) Login(ctx context.Context, input LoginInput) (*model.AuthPayload, string, error) {
	emailNormalized := normalizeEmail(input.Email)
	if s.isLocked(emailNormalized) {
		return nil, "", model.ErrAccountLocked
	}

	user, err := s.users.FindActiveUserByEmailNormalized(ctx, emailNormalized)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", s.recordLoginFailure(emailNormalized)
		}
		return nil, "", model.ErrDBError
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, "", s.recordLoginFailure(emailNormalized)
	}

	s.clearLoginFailure(emailNormalized)
	return s.issueSession(ctx, user)
}

func (s *AuthService) ValidateAccessToken(ctx context.Context, tokenString string) (*model.AuthUser, error) {
	claims := &accessClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, model.ErrTokenInvalid
		}
		return s.accessKey, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, model.ErrTokenExpired
		}
		return nil, model.ErrTokenInvalid
	}
	if !token.Valid || claims.Subject == "" {
		return nil, model.ErrTokenInvalid
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, model.ErrTokenInvalid
	}
	user, err := s.users.FindActiveUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, model.ErrTokenInvalid
		}
		return nil, model.ErrDBError
	}
	authUser := model.NewAuthUser(user)
	return &authUser, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*model.AuthPayload, string, error) {
	if refreshToken == "" {
		return nil, "", model.ErrRefreshTokenInvalid
	}

	oldToken, err := s.refresh.FindActiveRefreshTokenByHash(ctx, hashRefreshToken(refreshToken))
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", model.ErrRefreshTokenInvalid
		}
		return nil, "", model.ErrDBError
	}
	if !oldToken.ExpiresAt.After(s.now()) {
		return nil, "", model.ErrRefreshTokenInvalid
	}

	user, err := s.users.FindActiveUserByID(ctx, oldToken.UserID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", model.ErrRefreshTokenInvalid
		}
		return nil, "", model.ErrDBError
	}

	payload, newRefresh, newToken, err := s.buildSession(user)
	if err != nil {
		return nil, "", err
	}
	if err := s.refresh.RotateRefreshToken(ctx, oldToken.ID, newToken, s.now()); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", model.ErrRefreshTokenInvalid
		}
		return nil, "", model.ErrDBError
	}
	return payload, newRefresh, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	token, err := s.refresh.FindActiveRefreshTokenByHash(ctx, hashRefreshToken(refreshToken))
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil
		}
		return model.ErrDBError
	}
	if err := s.refresh.RevokeRefreshToken(ctx, token.ID, nil, s.now()); err != nil && !errors.Is(err, repository.ErrNotFound) {
		return model.ErrDBError
	}
	return nil
}

func (s *AuthService) issueSession(ctx context.Context, user *model.User) (*model.AuthPayload, string, error) {
	payload, refreshPlaintext, refreshToken, err := s.buildSession(user)
	if err != nil {
		return nil, "", err
	}
	if err := s.refresh.CreateRefreshToken(ctx, refreshToken); err != nil {
		return nil, "", model.ErrDBError
	}
	return payload, refreshPlaintext, nil
}

func (s *AuthService) buildSession(user *model.User) (*model.AuthPayload, string, *model.RefreshToken, error) {
	accessToken, err := s.signAccessToken(user)
	if err != nil {
		return nil, "", nil, err
	}
	refreshPlaintext, err := newOpaqueToken()
	if err != nil {
		return nil, "", nil, model.ErrInternalServer
	}
	refreshToken := &model.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: hashRefreshToken(refreshPlaintext),
		ExpiresAt: s.now().Add(s.refreshTTL),
		CreatedAt: s.now(),
	}
	return &model.AuthPayload{
		AccessToken: accessToken,
		User:        model.NewAuthUser(user),
	}, refreshPlaintext, refreshToken, nil
}

func (s *AuthService) signAccessToken(user *model.User) (string, error) {
	now := s.now()
	claims := accessClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.accessKey)
	if err != nil {
		return "", model.ErrInternalServer
	}
	return signed, nil
}

func validateRegister(input RegisterInput) error {
	if !usernamePattern.MatchString(input.Username) {
		return model.ErrUsernameFormatInvalid
	}
	if !strings.Contains(input.Email, "@") {
		return model.ErrEmailFormatInvalid
	}
	if len(input.Password) < 8 || !containsLetterAndDigit(input.Password) {
		return model.ErrPasswordTooWeak
	}
	if input.Password != input.ConfirmPassword {
		return model.ErrInvalidParam
	}
	return nil
}

func containsLetterAndDigit(value string) bool {
	hasLetter := false
	hasDigit := false
	for _, char := range value {
		switch {
		case char >= '0' && char <= '9':
			hasDigit = true
		case (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z'):
			hasLetter = true
		}
	}
	return hasLetter && hasDigit
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func (s *AuthService) isLocked(emailNormalized string) bool {
	s.lockMu.Lock()
	defer s.lockMu.Unlock()

	state := s.loginFailure[emailNormalized]
	return state.lockedUntil.After(s.now())
}

func (s *AuthService) recordLoginFailure(emailNormalized string) error {
	s.lockMu.Lock()
	defer s.lockMu.Unlock()

	state := s.loginFailure[emailNormalized]
	state.count++
	if state.count >= s.lockLimit {
		state.lockedUntil = s.now().Add(s.lockTTL)
		s.loginFailure[emailNormalized] = state
		return model.ErrAccountLocked
	}
	s.loginFailure[emailNormalized] = state
	return model.ErrInvalidCredential
}

func (s *AuthService) clearLoginFailure(emailNormalized string) {
	s.lockMu.Lock()
	defer s.lockMu.Unlock()
	delete(s.loginFailure, emailNormalized)
}

func newOpaqueToken() (string, error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw[:]), nil
}

func hashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
