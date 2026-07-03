package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Addr             string
	DatabaseURL      string
	AccessTokenKey   []byte
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	AccountLockLimit int
	AccountLockTTL   time.Duration
}

func Load() Config {
	return Config{
		Addr:             env("SERVER_ADDR", ":8080"),
		DatabaseURL:      env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/vega_resume?sslmode=disable"),
		AccessTokenKey:   []byte(env("ACCESS_TOKEN_KEY", "dev-access-secret-change-me")),
		AccessTokenTTL:   durationEnv("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:  durationEnv("REFRESH_TOKEN_TTL", 7*24*time.Hour),
		AccountLockLimit: intEnv("ACCOUNT_LOCK_LIMIT", 5),
		AccountLockTTL:   durationEnv("ACCOUNT_LOCK_TTL", 15*time.Minute),
	}
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
