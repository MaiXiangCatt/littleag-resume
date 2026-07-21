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

const minAccessTokenKeyLength = 32

type Config struct {
	Addr             string
	DatabaseURL      string
	AccessTokenKey   []byte
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	AccountLockLimit int
	AccountLockTTL   time.Duration
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

	return Config{
		Addr:             env("SERVER_ADDR", ":8080"),
		DatabaseURL:      env("DATABASE_URL", "postgres://vega_resume:vega_resume@localhost:5432/vega_resume?sslmode=disable"),
		AccessTokenKey:   []byte(accessTokenKey),
		AccessTokenTTL:   durationEnv("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:  durationEnv("REFRESH_TOKEN_TTL", 7*24*time.Hour),
		AccountLockLimit: intEnv("ACCOUNT_LOCK_LIMIT", 5),
		AccountLockTTL:   durationEnv("ACCOUNT_LOCK_TTL", 15*time.Minute),
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
