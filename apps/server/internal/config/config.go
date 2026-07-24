package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const (
	minAccessTokenKeyLength       = 32
	minEmailVerificationKeyLength = 32
)

type Config struct {
	Addr             string
	DatabaseURL      string
	AccessTokenKey   []byte
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	AccountLockLimit int
	AccountLockTTL   time.Duration
	AvatarStorageDir string
	TrustedProxies   []string

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

func Load() (Config, error) {
	return LoadFrom("apps/server/.env", ".env")
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

	return Config{
		Addr:             env("SERVER_ADDR", ":8080"),
		DatabaseURL:      env("DATABASE_URL", "postgres://vega_resume:vega_resume@localhost:5432/vega_resume?sslmode=disable"),
		AccessTokenKey:   []byte(accessTokenKey),
		AccessTokenTTL:   durationEnv("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:  durationEnv("REFRESH_TOKEN_TTL", 7*24*time.Hour),
		AccountLockLimit: intEnv("ACCOUNT_LOCK_LIMIT", 5),
		AccountLockTTL:   durationEnv("ACCOUNT_LOCK_TTL", 15*time.Minute),
		AvatarStorageDir: env("AVATAR_STORAGE_DIR", "data/avatars"),
		TrustedProxies:   stringListEnv("TRUSTED_PROXIES", []string{"127.0.0.1", "::1"}),

		EmailProvider:          emailProvider,
		ResendAPIKey:           resendAPIKey,
		MailFrom:               mailFrom,
		EmailProductName:       env("EMAIL_PRODUCT_NAME", "Vega Resume"),
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
