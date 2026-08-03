package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const (
	minAccessTokenKeyLength       = 32
	minAnalyticsHashKeyLength     = 32
	minEmailVerificationKeyLength = 32
)

type Config struct {
	Environment          string
	Addr                 string
	DatabaseURL          string
	RegistrationMode     string
	InvitationChallenges []InvitationChallenge
	AccessTokenKey       []byte
	AccessTokenTTL       time.Duration
	RefreshTokenTTL      time.Duration
	AccountLockLimit     int
	AccountLockTTL       time.Duration
	LoginFailureCapacity int
	AvatarStorageDir     string
	TrustedProxies       []string
	AnalyticsEnabled     bool
	AnalyticsHashKey     []byte
	AnalyticsOrigins     []string

	EmailProvider          string
	ResendAPIKey           string
	MailFrom               string
	EmailProductName       string
	EmailVerificationKey   []byte
	EmailVerificationTTL   time.Duration
	EmailVerificationLimit int
	EmailResendCooldown    time.Duration

	WebBaseURL        string
	ChromeExecPath    string
	ChromeRemoteURL   string
	PdfRenderTimeout  time.Duration
	PdfMaxConcurrency int
	PdfMaxQueue       int
	PrintTokenTTL     time.Duration
}

type InvitationChallenge struct {
	ID     string `json:"id"`
	Prompt string `json:"prompt"`
	Answer string `json:"answer"`
}

type invitationChallengeFile struct {
	Challenges []InvitationChallenge `json:"challenges"`
}

func Load() (Config, error) {
	environment := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if environment == "" {
		environment = "dev"
	}
	if environment != "dev" && environment != "prod" {
		return Config{}, fmt.Errorf("APP_ENV must be dev or prod")
	}
	config, err := LoadFrom(
		"apps/server/.env."+environment,
		".env."+environment,
	)
	if err != nil {
		return Config{}, err
	}
	config.Environment = environment
	return config, nil
}

func LoadFrom(dotenvPaths ...string) (Config, error) {
	if err := loadDotEnv(dotenvPaths...); err != nil {
		return Config{}, err
	}

	accessTokenKey := strings.TrimSpace(os.Getenv("ACCESS_TOKEN_KEY"))
	if len(accessTokenKey) < minAccessTokenKeyLength {
		return Config{}, fmt.Errorf("ACCESS_TOKEN_KEY must contain at least %d characters", minAccessTokenKeyLength)
	}
	emailVerificationKey := strings.TrimSpace(os.Getenv("EMAIL_VERIFICATION_KEY"))
	if len(emailVerificationKey) < minEmailVerificationKeyLength {
		return Config{}, fmt.Errorf(
			"EMAIL_VERIFICATION_KEY must contain at least %d characters",
			minEmailVerificationKeyLength,
		)
	}
	emailProvider := strings.ToLower(env("EMAIL_PROVIDER", "console"))
	if emailProvider != "console" && emailProvider != "resend" {
		return Config{}, fmt.Errorf("EMAIL_PROVIDER must be console or resend")
	}
	resendAPIKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	mailFrom := strings.TrimSpace(os.Getenv("MAIL_FROM"))
	if emailProvider == "resend" && (resendAPIKey == "" || mailFrom == "") {
		return Config{}, fmt.Errorf("RESEND_API_KEY and MAIL_FROM are required when EMAIL_PROVIDER=resend")
	}
	databaseURL, err := resolveDatabaseURL()
	if err != nil {
		return Config{}, err
	}
	registrationMode := strings.ToLower(env("REGISTRATION_MODE", "open"))
	if registrationMode != "open" && registrationMode != "invite" && registrationMode != "closed" {
		return Config{}, fmt.Errorf("REGISTRATION_MODE must be open, invite, or closed")
	}
	invitationChallenges, err := loadInvitationChallenges(
		strings.TrimSpace(os.Getenv("INVITATION_CHALLENGES_FILE")),
		registrationMode,
	)
	if err != nil {
		return Config{}, err
	}
	analyticsEnabled, err := boolEnv("ANALYTICS_ENABLED", false)
	if err != nil {
		return Config{}, err
	}
	analyticsHashKey, err := loadOptionalSecret(
		"ANALYTICS_HASH_KEY_FILE",
		minAnalyticsHashKeyLength,
		analyticsEnabled,
	)
	if err != nil {
		return Config{}, err
	}
	analyticsOrigins, err := parseOrigins("ANALYTICS_ALLOWED_ORIGINS")
	if err != nil {
		return Config{}, err
	}
	if analyticsEnabled && environmentIsProduction() && len(analyticsOrigins) == 0 {
		return Config{}, fmt.Errorf("ANALYTICS_ALLOWED_ORIGINS is required when analytics is enabled in production")
	}

	return Config{
		Addr:                 env("SERVER_ADDR", ":8080"),
		DatabaseURL:          databaseURL,
		RegistrationMode:     registrationMode,
		InvitationChallenges: invitationChallenges,
		AccessTokenKey:       []byte(accessTokenKey),
		AccessTokenTTL:       durationEnv("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:      durationEnv("REFRESH_TOKEN_TTL", 7*24*time.Hour),
		AccountLockLimit:     intEnv("ACCOUNT_LOCK_LIMIT", 5),
		AccountLockTTL:       durationEnv("ACCOUNT_LOCK_TTL", 15*time.Minute),
		LoginFailureCapacity: intEnv("LOGIN_FAILURE_CAPACITY", 10_000),
		AvatarStorageDir:     env("AVATAR_STORAGE_DIR", "data/avatars"),
		TrustedProxies:       stringListEnv("TRUSTED_PROXIES", []string{"127.0.0.1", "::1"}),
		AnalyticsEnabled:     analyticsEnabled,
		AnalyticsHashKey:     analyticsHashKey,
		AnalyticsOrigins:     analyticsOrigins,

		EmailProvider:          emailProvider,
		ResendAPIKey:           resendAPIKey,
		MailFrom:               mailFrom,
		EmailProductName:       env("EMAIL_PRODUCT_NAME", "LittleAgResume"),
		EmailVerificationKey:   []byte(emailVerificationKey),
		EmailVerificationTTL:   durationEnv("EMAIL_VERIFICATION_TTL", 10*time.Minute),
		EmailVerificationLimit: intEnv("EMAIL_VERIFICATION_ATTEMPT_LIMIT", 5),
		EmailResendCooldown:    durationEnv("EMAIL_RESEND_COOLDOWN", time.Minute),

		WebBaseURL:        env("WEB_BASE_URL", "http://localhost:5173"),
		ChromeExecPath:    env("CHROME_EXEC_PATH", ""),
		ChromeRemoteURL:   env("CHROME_REMOTE_URL", ""),
		PdfRenderTimeout:  durationEnv("PDF_RENDER_TIMEOUT", 30*time.Second),
		PdfMaxConcurrency: intEnv("PDF_MAX_CONCURRENCY", 2),
		PdfMaxQueue:       intEnv("PDF_MAX_QUEUE", 8),
		PrintTokenTTL:     durationEnv("PRINT_TOKEN_TTL", 90*time.Second),
	}, nil
}

func loadOptionalSecret(name string, minLength int, required bool) ([]byte, error) {
	path := strings.TrimSpace(os.Getenv(name))
	if path == "" {
		if required {
			return nil, fmt.Errorf("%s is required when analytics is enabled", name)
		}
		return nil, nil
	}
	contents, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", name, err)
	}
	contents = bytes.TrimSpace(contents)
	if len(contents) < minLength {
		return nil, fmt.Errorf("%s must contain at least %d bytes", name, minLength)
	}
	return contents, nil
}

func parseOrigins(name string) ([]string, error) {
	values := stringListEnv(name, nil)
	origins := make([]string, 0, len(values))
	for _, value := range values {
		parsed, err := url.Parse(value)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.Path != "" ||
			parsed.RawQuery != "" || parsed.Fragment != "" || parsed.User != nil {
			return nil, fmt.Errorf("%s contains invalid origin %q", name, value)
		}
		if parsed.Scheme != "http" && parsed.Scheme != "https" {
			return nil, fmt.Errorf("%s origin %q must use http or https", name, value)
		}
		origins = append(origins, parsed.Scheme+"://"+parsed.Host)
	}
	return origins, nil
}

func environmentIsProduction() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "prod")
}

func loadInvitationChallenges(path, registrationMode string) ([]InvitationChallenge, error) {
	if registrationMode == "closed" {
		return nil, nil
	}
	if path == "" {
		if registrationMode == "invite" {
			return nil, fmt.Errorf("INVITATION_CHALLENGES_FILE is required when REGISTRATION_MODE=invite")
		}
		if registrationMode == "open" {
			return []InvitationChallenge{
				{ID: "shan-se-you-wu-zhong", Prompt: "山色有无中，", Answer: "不如就春风"},
				{ID: "yi-ci-lin-qing", Prompt: "异次临倾，", Answer: "步步唯银"},
			}, nil
		}
		return nil, nil
	}

	contents, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read invitation challenges file %q: %w", path, err)
	}
	var parsed invitationChallengeFile
	decoder := json.NewDecoder(bytes.NewReader(contents))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&parsed); err != nil {
		return nil, fmt.Errorf("decode invitation challenges file %q: %w", path, err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("decode invitation challenges file %q: trailing content", path)
	}
	if len(parsed.Challenges) == 0 {
		return nil, fmt.Errorf("invitation challenges file %q must contain at least one challenge", path)
	}

	seenIDs := make(map[string]struct{}, len(parsed.Challenges))
	challenges := make([]InvitationChallenge, 0, len(parsed.Challenges))
	for index, challenge := range parsed.Challenges {
		challenge.ID = strings.TrimSpace(challenge.ID)
		challenge.Prompt = strings.TrimSpace(challenge.Prompt)
		challenge.Answer = strings.TrimSpace(challenge.Answer)
		if challenge.ID == "" || challenge.Prompt == "" || challenge.Answer == "" {
			return nil, fmt.Errorf(
				"invitation challenge at index %d must have non-empty id, prompt, and answer",
				index,
			)
		}
		if _, exists := seenIDs[challenge.ID]; exists {
			return nil, fmt.Errorf("invitation challenge id %q is duplicated", challenge.ID)
		}
		seenIDs[challenge.ID] = struct{}{}
		challenges = append(challenges, challenge)
	}
	return challenges, nil
}

func resolveDatabaseURL() (string, error) {
	if configuredURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); configuredURL != "" {
		return configuredURL, nil
	}

	passwordFile := strings.TrimSpace(os.Getenv("DATABASE_PASSWORD_FILE"))
	if passwordFile == "" {
		return "postgres://vega_resume:vega_resume@localhost:5432/vega_resume?sslmode=disable", nil
	}
	passwordBytes, err := os.ReadFile(passwordFile)
	if err != nil {
		return "", fmt.Errorf("read DATABASE_PASSWORD_FILE: %w", err)
	}
	password := strings.TrimSpace(string(passwordBytes))
	if password == "" {
		return "", fmt.Errorf("DATABASE_PASSWORD_FILE must not be empty")
	}

	query := url.Values{}
	query.Set("sslmode", env("DATABASE_SSLMODE", "disable"))
	databaseURL := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(env("DATABASE_USER", "littleag_resume"), password),
		Host:     net.JoinHostPort(env("DATABASE_HOST", "localhost"), env("DATABASE_PORT", "5432")),
		Path:     "/" + env("DATABASE_NAME", "littleag_resume"),
		RawQuery: query.Encode(),
	}
	return databaseURL.String(), nil
}

func loadDotEnv(paths ...string) error {
	for _, path := range paths {
		err := godotenv.Load(path)
		if err == nil {
			return nil
		}
		if !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("load dotenv %q: %w", path, err)
		}
	}
	return nil
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func intEnv(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func boolEnv(key string, fallback bool) (bool, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s must be true or false", key)
	}
	return parsed, nil
}

func stringListEnv(key string, fallback []string) []string {
	value := os.Getenv(key)
	if value == "" {
		return append([]string(nil), fallback...)
	}
	items := make([]string, 0)
	for _, item := range strings.Split(value, ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}
