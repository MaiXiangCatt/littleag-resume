package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
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

var (
	usernamePattern         = regexp.MustCompile(`^[A-Za-z0-9_\p{Han}-]{2,32}$`)
	verificationCodePattern = regexp.MustCompile(`^[0-9]{6}$`)
)

const (
	maxEmailBytes               = 254
	maxPasswordLength           = 128
	defaultLoginFailureCapacity = 10_000
)

type RegisterInput struct {
	Username         string
	Email            string
	Password         string
	ConfirmPassword  string
	VerificationCode string
	InvitationCode   string
}

type LoginInput struct {
	Email    string
	Password string
}

type ConfirmEmailVerificationInput struct {
	Email string
	Code  string
}

type ResendEmailVerificationInput struct {
	Email    string
	Password string
}

type EmailVerificationPayload struct {
	Email              string `json:"email"`
	ExpiresInSeconds   int    `json:"expiresInSeconds"`
	ResendAfterSeconds int    `json:"resendAfterSeconds"`
}

type VerificationEmailSender interface {
	SendVerificationCode(ctx context.Context, recipient, code string, ttl time.Duration) error
}

type AuthServiceConfig struct {
	Users                     repository.UserRepository
	EmailVerifications        repository.EmailVerificationRepository
	RegistrationVerifications repository.RegistrationEmailVerificationRepository
	RegistrationInvitations   repository.RegistrationInvitationRepository
	RegistrationMode          model.RegistrationMode
	RefreshTokens             repository.RefreshTokenRepository
	VerificationEmailSender   VerificationEmailSender
	EmailVerificationKey      []byte
	EmailVerificationTTL      time.Duration
	EmailVerificationLimit    int
	EmailResendCooldown       time.Duration
	AccessTokenKey            []byte
	AccessTokenTTL            time.Duration
	RefreshTokenTTL           time.Duration
	AccountLockLimit          int
	AccountLockTTL            time.Duration
	LoginFailureCapacity      int
	Now                       func() time.Time
}

type AuthService struct {
	users                     repository.UserRepository
	emailVerifications        repository.EmailVerificationRepository
	registrationVerifications repository.RegistrationEmailVerificationRepository
	registrationInvitations   repository.RegistrationInvitationRepository
	registrationMode          model.RegistrationMode
	refresh                   repository.RefreshTokenRepository
	verificationEmailSender   VerificationEmailSender
	emailVerificationKey      []byte
	emailVerificationTTL      time.Duration
	emailVerificationLimit    int
	emailResendCooldown       time.Duration
	accessKey                 []byte
	accessTTL                 time.Duration
	refreshTTL                time.Duration
	lockLimit                 int
	lockTTL                   time.Duration
	loginFailureCapacity      int
	loginFailureCleanupAt     time.Time
	now                       func() time.Time
	lockMu                    sync.Mutex
	loginFailure              map[string]loginFailure
}

type loginFailure struct {
	count       int
	lockedUntil time.Time
	expiresAt   time.Time
}

type accessClaims struct {
	jwt.RegisteredClaims
}

func NewAuthService(config AuthServiceConfig) *AuthService {
	if config.EmailVerificationTTL == 0 {
		config.EmailVerificationTTL = 10 * time.Minute
	}
	if config.EmailVerificationLimit == 0 {
		config.EmailVerificationLimit = 5
	}
	if config.EmailResendCooldown == 0 {
		config.EmailResendCooldown = time.Minute
	}
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
	if config.LoginFailureCapacity <= 0 {
		config.LoginFailureCapacity = defaultLoginFailureCapacity
	}
	if config.Now == nil {
		config.Now = func() time.Time { return time.Now().UTC() }
	}
	now := config.Now()
	return &AuthService{
		users:                     config.Users,
		emailVerifications:        config.EmailVerifications,
		registrationVerifications: config.RegistrationVerifications,
		registrationInvitations:   config.RegistrationInvitations,
		registrationMode:          config.RegistrationMode,
		refresh:                   config.RefreshTokens,
		verificationEmailSender:   config.VerificationEmailSender,
		emailVerificationKey:      append([]byte(nil), config.EmailVerificationKey...),
		emailVerificationTTL:      config.EmailVerificationTTL,
		emailVerificationLimit:    config.EmailVerificationLimit,
		emailResendCooldown:       config.EmailResendCooldown,
		accessKey:                 config.AccessTokenKey,
		accessTTL:                 config.AccessTokenTTL,
		refreshTTL:                config.RefreshTokenTTL,
		lockLimit:                 config.AccountLockLimit,
		lockTTL:                   config.AccountLockTTL,
		loginFailureCapacity:      config.LoginFailureCapacity,
		loginFailureCleanupAt:     now.Add(config.AccountLockTTL),
		now:                       config.Now,
		loginFailure:              map[string]loginFailure{},
	}
}

func (s *AuthService) Register(
	ctx context.Context,
	input RegisterInput,
) (*model.AuthPayload, string, error) {
	if s.registrationMode == model.RegistrationModeClosed {
		return nil, "", model.ErrRegistrationClosed
	}
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

	challenge, err := s.validateRegistrationVerification(ctx, emailNormalized, input.VerificationCode)
	if err != nil {
		return nil, "", err
	}
	invitationID, err := s.activeInvitationID(ctx, input.InvitationCode)
	if err != nil {
		return nil, "", err
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
		EmailVerifiedAt: &now,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.registrationVerifications.CreateVerifiedUser(
		ctx,
		challenge.ID,
		invitationID,
		user,
		now,
	); err != nil {
		if errors.Is(err, repository.ErrInvitationInvalid) {
			return nil, "", model.ErrInvitationInvalid
		}
		if errors.Is(err, repository.ErrDuplicateEmail) {
			return nil, "", model.ErrEmailExists
		}
		if errors.Is(err, repository.ErrDuplicateUsername) {
			return nil, "", model.ErrUsernameExists
		}
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", model.ErrVerificationInvalid
		}
		return nil, "", model.ErrDBError
	}

	return s.issueSession(ctx, user)
}

func (s *AuthService) SendRegistrationEmailVerification(
	ctx context.Context,
	email string,
	invitationCode string,
) (*EmailVerificationPayload, error) {
	if s.registrationMode == model.RegistrationModeClosed {
		return nil, model.ErrRegistrationClosed
	}
	email = strings.TrimSpace(email)
	if !validEmail(email) {
		return nil, model.ErrEmailFormatInvalid
	}
	emailNormalized := normalizeEmail(email)
	if _, err := s.users.FindActiveUserByEmailNormalized(ctx, emailNormalized); err == nil {
		return nil, model.ErrEmailExists
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, model.ErrDBError
	}
	if _, err := s.activeInvitationID(ctx, invitationCode); err != nil {
		return nil, err
	}
	if s.registrationVerifications == nil ||
		s.verificationEmailSender == nil ||
		len(s.emailVerificationKey) == 0 {
		return nil, model.ErrEmailDeliveryFailed
	}

	now := s.now()
	current, err := s.registrationVerifications.FindActiveRegistrationEmailVerification(ctx, emailNormalized)
	if err == nil && current.SentAt != nil {
		resendAt := current.SentAt.Add(s.emailResendCooldown)
		if resendAt.After(now) && current.ExpiresAt.After(now) {
			return verificationPayload(email, current.ExpiresAt.Sub(now), resendAt.Sub(now)), nil
		}
	} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, model.ErrDBError
	}

	code, err := newVerificationCode()
	if err != nil {
		return nil, model.ErrInternalServer
	}
	challenge := &model.RegistrationEmailVerification{
		ID:              uuid.New(),
		Email:           email,
		EmailNormalized: emailNormalized,
		ExpiresAt:       now.Add(s.emailVerificationTTL),
		CreatedAt:       now,
	}
	challenge.CodeMAC = verificationCodeMAC(s.emailVerificationKey, challenge.ID, code)
	if err := s.registrationVerifications.ReplaceRegistrationEmailVerification(ctx, challenge, now); err != nil {
		return nil, model.ErrDBError
	}
	if err := s.verificationEmailSender.SendVerificationCode(
		ctx,
		email,
		code,
		s.emailVerificationTTL,
	); err != nil {
		_ = s.registrationVerifications.InvalidateRegistrationEmailVerification(ctx, challenge.ID, now)
		return nil, model.ErrEmailDeliveryFailed
	}
	if err := s.registrationVerifications.MarkRegistrationEmailVerificationSent(
		ctx,
		challenge.ID,
		now,
	); err != nil {
		return nil, model.ErrDBError
	}
	return verificationPayload(email, s.emailVerificationTTL, s.emailResendCooldown), nil
}

func (s *AuthService) activeInvitationID(
	ctx context.Context,
	invitationCode string,
) (*uuid.UUID, error) {
	if s.registrationMode != model.RegistrationModeInvite {
		return nil, nil
	}
	if s.registrationInvitations == nil {
		return nil, model.ErrInvitationInvalid
	}
	codeHash, ok := registrationInvitationCodeHash(invitationCode)
	if !ok {
		return nil, model.ErrInvitationInvalid
	}
	invitation, err := s.registrationInvitations.FindActiveRegistrationInvitationByCodeHash(
		ctx,
		codeHash,
		s.now(),
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, model.ErrInvitationInvalid
		}
		return nil, model.ErrDBError
	}
	id := invitation.ID
	return &id, nil
}

func (s *AuthService) Login(ctx context.Context, input LoginInput) (*model.AuthPayload, string, error) {
	if !validEmail(input.Email) || len(input.Password) > maxPasswordLength {
		return nil, "", model.ErrInvalidCredential
	}
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
	if user.EmailVerifiedAt == nil {
		return nil, "", model.ErrEmailNotVerified
	}

	return s.issueSession(ctx, user)
}

func (s *AuthService) ConfirmEmailVerification(
	ctx context.Context,
	input ConfirmEmailVerificationInput,
) (*model.AuthPayload, string, error) {
	if !validEmail(input.Email) {
		return nil, "", model.ErrVerificationInvalid
	}
	emailNormalized := normalizeEmail(input.Email)
	if !verificationCodePattern.MatchString(input.Code) {
		return nil, "", model.ErrVerificationInvalid
	}
	user, err := s.users.FindActiveUserByEmailNormalized(ctx, emailNormalized)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", model.ErrVerificationInvalid
		}
		return nil, "", model.ErrDBError
	}
	if user.EmailVerifiedAt != nil {
		return nil, "", model.ErrVerificationInvalid
	}
	challenge, err := s.emailVerifications.FindActiveEmailVerificationChallengeByUserID(ctx, user.ID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", model.ErrVerificationInvalid
		}
		return nil, "", model.ErrDBError
	}
	now := s.now()
	if challenge.SentAt == nil ||
		!challenge.ExpiresAt.After(now) ||
		challenge.Attempts >= s.emailVerificationLimit {
		return nil, "", model.ErrVerificationInvalid
	}

	expectedMAC := verificationCodeMAC(s.emailVerificationKey, challenge.ID, input.Code)
	if !hmac.Equal([]byte(challenge.CodeMAC), []byte(expectedMAC)) {
		attempts, err := s.emailVerifications.IncrementEmailVerificationFailures(ctx, challenge.ID)
		if err != nil {
			return nil, "", model.ErrDBError
		}
		if attempts >= s.emailVerificationLimit {
			_ = s.emailVerifications.InvalidateEmailVerificationChallenge(ctx, challenge.ID, now)
		}
		return nil, "", model.ErrVerificationInvalid
	}
	if err := s.emailVerifications.ConsumeEmailVerificationChallenge(ctx, challenge.ID, user.ID, now); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", model.ErrVerificationInvalid
		}
		return nil, "", model.ErrDBError
	}
	user.EmailVerifiedAt = &now
	return s.issueSession(ctx, user)
}

func (s *AuthService) ResendEmailVerification(
	ctx context.Context,
	input ResendEmailVerificationInput,
) (*EmailVerificationPayload, error) {
	if !validEmail(input.Email) || len(input.Password) > maxPasswordLength {
		return nil, model.ErrInvalidCredential
	}
	emailNormalized := normalizeEmail(input.Email)
	user, err := s.users.FindActiveUserByEmailNormalized(ctx, emailNormalized)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, model.ErrInvalidCredential
		}
		return nil, model.ErrDBError
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, model.ErrInvalidCredential
	}
	if user.EmailVerifiedAt != nil {
		return nil, model.ErrInvalidParam
	}
	return s.issueEmailVerification(ctx, user, true)
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
	if user.EmailVerifiedAt == nil {
		return nil, "", model.ErrRefreshTokenInvalid
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
	if user.EmailVerifiedAt == nil {
		return nil, "", model.ErrEmailNotVerified
	}
	payload, refreshPlaintext, refreshToken, err := s.buildSession(user)
	if err != nil {
		return nil, "", err
	}
	if err := s.refresh.CreateRefreshToken(ctx, refreshToken); err != nil {
		return nil, "", model.ErrDBError
	}
	return payload, refreshPlaintext, nil
}

func (s *AuthService) issueEmailVerification(
	ctx context.Context,
	user *model.User,
	honorCooldown bool,
) (*EmailVerificationPayload, error) {
	if s.emailVerifications == nil || s.verificationEmailSender == nil || len(s.emailVerificationKey) == 0 {
		return nil, model.ErrEmailDeliveryFailed
	}

	now := s.now()
	if honorCooldown {
		current, err := s.emailVerifications.FindActiveEmailVerificationChallengeByUserID(ctx, user.ID)
		if err == nil && current.SentAt != nil {
			resendAt := current.SentAt.Add(s.emailResendCooldown)
			if resendAt.After(now) && current.ExpiresAt.After(now) {
				return verificationPayload(user.Email, current.ExpiresAt.Sub(now), resendAt.Sub(now)), nil
			}
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, model.ErrDBError
		}
	}

	code, err := newVerificationCode()
	if err != nil {
		return nil, model.ErrInternalServer
	}
	challenge := &model.EmailVerificationChallenge{
		ID:        uuid.New(),
		UserID:    user.ID,
		ExpiresAt: now.Add(s.emailVerificationTTL),
		CreatedAt: now,
	}
	challenge.CodeMAC = verificationCodeMAC(s.emailVerificationKey, challenge.ID, code)
	if err := s.emailVerifications.ReplaceEmailVerificationChallenge(ctx, challenge, now); err != nil {
		return nil, model.ErrDBError
	}
	if err := s.verificationEmailSender.SendVerificationCode(
		ctx,
		user.Email,
		code,
		s.emailVerificationTTL,
	); err != nil {
		_ = s.emailVerifications.InvalidateEmailVerificationChallenge(ctx, challenge.ID, now)
		return nil, model.ErrEmailDeliveryFailed
	}
	if err := s.emailVerifications.MarkEmailVerificationSent(ctx, challenge.ID, now); err != nil {
		return nil, model.ErrDBError
	}
	return verificationPayload(user.Email, s.emailVerificationTTL, s.emailResendCooldown), nil
}

func (s *AuthService) validateRegistrationVerification(
	ctx context.Context,
	emailNormalized, code string,
) (*model.RegistrationEmailVerification, error) {
	if s.registrationVerifications == nil || !verificationCodePattern.MatchString(code) {
		return nil, model.ErrVerificationInvalid
	}
	challenge, err := s.registrationVerifications.FindActiveRegistrationEmailVerification(
		ctx,
		emailNormalized,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, model.ErrVerificationInvalid
		}
		return nil, model.ErrDBError
	}
	now := s.now()
	if challenge.SentAt == nil ||
		!challenge.ExpiresAt.After(now) ||
		challenge.Attempts >= s.emailVerificationLimit {
		return nil, model.ErrVerificationInvalid
	}

	expectedMAC := verificationCodeMAC(s.emailVerificationKey, challenge.ID, code)
	if hmac.Equal([]byte(challenge.CodeMAC), []byte(expectedMAC)) {
		return challenge, nil
	}
	attempts, err := s.registrationVerifications.IncrementRegistrationEmailVerificationFailures(
		ctx,
		challenge.ID,
	)
	if err != nil {
		return nil, model.ErrDBError
	}
	if attempts >= s.emailVerificationLimit {
		_ = s.registrationVerifications.InvalidateRegistrationEmailVerification(
			ctx,
			challenge.ID,
			now,
		)
	}
	return nil, model.ErrVerificationInvalid
}

func verificationPayload(email string, expiresIn, resendAfter time.Duration) *EmailVerificationPayload {
	return &EmailVerificationPayload{
		Email:              email,
		ExpiresInSeconds:   durationSecondsCeil(expiresIn),
		ResendAfterSeconds: durationSecondsCeil(resendAfter),
	}
}

func durationSecondsCeil(value time.Duration) int {
	if value <= 0 {
		return 0
	}
	return int((value + time.Second - 1) / time.Second)
}

func newVerificationCode() (string, error) {
	value, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", value.Int64()), nil
}

func verificationCodeMAC(key []byte, challengeID uuid.UUID, code string) string {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(challengeID.String()))
	_, _ = mac.Write([]byte{':'})
	_, _ = mac.Write([]byte(code))
	return hex.EncodeToString(mac.Sum(nil))
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
	if !validEmail(input.Email) {
		return model.ErrEmailFormatInvalid
	}
	if len(input.Password) < 8 ||
		len(input.Password) > maxPasswordLength ||
		!containsLetterAndDigit(input.Password) {
		return model.ErrPasswordTooWeak
	}
	if input.Password != input.ConfirmPassword {
		return model.ErrInvalidParam
	}
	if !verificationCodePattern.MatchString(input.VerificationCode) {
		return model.ErrVerificationInvalid
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

func validEmail(email string) bool {
	trimmed := strings.TrimSpace(email)
	return len(trimmed) <= maxEmailBytes && strings.Contains(trimmed, "@")
}

func (s *AuthService) isLocked(emailNormalized string) bool {
	s.lockMu.Lock()
	defer s.lockMu.Unlock()

	state, exists := s.loginFailure[emailNormalized]
	if !exists {
		return false
	}
	now := s.now()
	if !state.expiresAt.After(now) {
		delete(s.loginFailure, emailNormalized)
		return false
	}
	return state.lockedUntil.After(now)
}

func (s *AuthService) recordLoginFailure(emailNormalized string) error {
	s.lockMu.Lock()
	defer s.lockMu.Unlock()

	now := s.now()
	if !now.Before(s.loginFailureCleanupAt) {
		s.pruneLoginFailures(now)
		s.loginFailureCleanupAt = now.Add(s.lockTTL)
	}
	state, exists := s.loginFailure[emailNormalized]
	if !exists && len(s.loginFailure) >= s.loginFailureCapacity {
		s.pruneLoginFailures(now)
		s.loginFailureCleanupAt = now.Add(s.lockTTL)
		if len(s.loginFailure) >= s.loginFailureCapacity {
			return model.ErrInvalidCredential
		}
	}
	state.count++
	state.expiresAt = now.Add(s.lockTTL)
	if state.count >= s.lockLimit {
		state.lockedUntil = now.Add(s.lockTTL)
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

func (s *AuthService) pruneLoginFailures(now time.Time) {
	for email, state := range s.loginFailure {
		if !state.expiresAt.After(now) {
			delete(s.loginFailure, email)
		}
	}
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
