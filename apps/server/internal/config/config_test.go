package config

import (
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadFromRequiresAccessTokenKey(t *testing.T) {
	withoutEnvironment(t, "ACCESS_TOKEN_KEY")
	t.Setenv("EMAIL_PROVIDER", "console")

	_, err := LoadFrom(filepath.Join(t.TempDir(), "missing.env"))
	if err == nil || !strings.Contains(err.Error(), "ACCESS_TOKEN_KEY") {
		t.Fatalf("expected missing ACCESS_TOKEN_KEY error, got %v", err)
	}
}

func TestLoadFromDotEnvWithoutOverridingEnvironment(t *testing.T) {
	withoutEnvironment(t, "ACCESS_TOKEN_KEY")
	withoutEnvironment(t, "EMAIL_VERIFICATION_KEY")
	t.Setenv("SERVER_ADDR", ":9090")
	t.Setenv("EMAIL_PROVIDER", "console")

	dotenvPath := filepath.Join(t.TempDir(), ".env")
	contents := "ACCESS_TOKEN_KEY=local-development-secret-with-32-bytes\n" +
		"EMAIL_VERIFICATION_KEY=local-email-verification-secret-32-bytes\n" +
		"SERVER_ADDR=:7070\n"
	if err := os.WriteFile(dotenvPath, []byte(contents), 0o600); err != nil {
		t.Fatalf("write dotenv: %v", err)
	}

	cfg, err := LoadFrom(dotenvPath)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if string(cfg.AccessTokenKey) != "local-development-secret-with-32-bytes" {
		t.Fatalf("unexpected access token key")
	}
	if cfg.Addr != ":9090" {
		t.Fatalf("environment should override .env, got %q", cfg.Addr)
	}
}

func TestLoadUsesEnvironmentSpecificDotEnvFromWorkingDirectory(t *testing.T) {
	withoutEnvironment(t, "ACCESS_TOKEN_KEY")
	withoutEnvironment(t, "EMAIL_VERIFICATION_KEY")
	t.Setenv("EMAIL_PROVIDER", "console")
	t.Setenv("APP_ENV", "dev")
	workingDirectory := t.TempDir()
	dotenvPath := filepath.Join(workingDirectory, ".env.dev")
	contents := "ACCESS_TOKEN_KEY=working-directory-secret-with-32-bytes\n" +
		"EMAIL_VERIFICATION_KEY=working-directory-email-secret-32-bytes\n"
	if err := os.WriteFile(dotenvPath, []byte(contents), 0o600); err != nil {
		t.Fatalf("write dotenv: %v", err)
	}
	t.Chdir(workingDirectory)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if string(cfg.AccessTokenKey) != "working-directory-secret-with-32-bytes" {
		t.Fatalf("unexpected access token key")
	}
	if cfg.Environment != "dev" {
		t.Fatalf("unexpected environment %q", cfg.Environment)
	}
}

func TestLoadRejectsUnknownEnvironment(t *testing.T) {
	t.Setenv("APP_ENV", "staging")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "APP_ENV") {
		t.Fatalf("expected APP_ENV validation error, got %v", err)
	}
}

func TestLoadFromValidatesResendConfiguration(t *testing.T) {
	t.Setenv("ACCESS_TOKEN_KEY", "test-access-token-key-with-enough-length")
	t.Setenv("EMAIL_VERIFICATION_KEY", "test-email-verification-key-with-enough-length")
	t.Setenv("EMAIL_PROVIDER", "resend")
	withoutEnvironment(t, "RESEND_API_KEY")
	withoutEnvironment(t, "MAIL_FROM")

	if _, err := LoadFrom(filepath.Join(t.TempDir(), "missing.env")); err == nil ||
		!strings.Contains(err.Error(), "RESEND_API_KEY") {
		t.Fatalf("expected missing Resend configuration error, got %v", err)
	}

	t.Setenv("RESEND_API_KEY", "re_test")
	t.Setenv("MAIL_FROM", "Product <verify@example.com>")
	t.Setenv("EMAIL_PRODUCT_NAME", "Renamed Product")
	t.Setenv("TRUSTED_PROXIES", "10.0.0.0/8, 172.16.0.0/12")
	cfg, err := LoadFrom(filepath.Join(t.TempDir(), "missing.env"))
	if err != nil {
		t.Fatalf("load resend config: %v", err)
	}
	if cfg.ResendAPIKey != "re_test" ||
		cfg.MailFrom != "Product <verify@example.com>" ||
		cfg.EmailProductName != "Renamed Product" {
		t.Fatalf("unexpected resend configuration: %+v", cfg)
	}
	if len(cfg.TrustedProxies) != 2 ||
		cfg.TrustedProxies[0] != "10.0.0.0/8" ||
		cfg.TrustedProxies[1] != "172.16.0.0/12" {
		t.Fatalf("unexpected trusted proxies: %+v", cfg.TrustedProxies)
	}
}

func TestLoadFromBuildsDatabaseURLFromPasswordFile(t *testing.T) {
	t.Setenv("ACCESS_TOKEN_KEY", "test-access-token-key-with-enough-length")
	t.Setenv("EMAIL_VERIFICATION_KEY", "test-email-verification-key-with-enough-length")
	t.Setenv("EMAIL_PROVIDER", "console")
	withoutEnvironment(t, "DATABASE_URL")
	passwordFile := filepath.Join(t.TempDir(), "postgres_password")
	if err := os.WriteFile(passwordFile, []byte("p@ss word\n"), 0o600); err != nil {
		t.Fatalf("write database password: %v", err)
	}
	t.Setenv("DATABASE_PASSWORD_FILE", passwordFile)
	t.Setenv("DATABASE_HOST", "postgres")
	t.Setenv("DATABASE_PORT", "5433")
	t.Setenv("DATABASE_USER", "littleag")
	t.Setenv("DATABASE_NAME", "resume")
	t.Setenv("DATABASE_SSLMODE", "require")

	cfg, err := LoadFrom(filepath.Join(t.TempDir(), "missing.env"))
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	parsed, err := url.Parse(cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("parse database URL: %v", err)
	}
	password, hasPassword := parsed.User.Password()
	if parsed.Host != "postgres:5433" ||
		parsed.User.Username() != "littleag" ||
		!hasPassword ||
		password != "p@ss word" ||
		parsed.Path != "/resume" ||
		parsed.Query().Get("sslmode") != "require" {
		t.Fatalf("unexpected database URL: %q", cfg.DatabaseURL)
	}
}

func TestLoadFromRejectsInvalidDatabasePasswordFile(t *testing.T) {
	t.Setenv("ACCESS_TOKEN_KEY", "test-access-token-key-with-enough-length")
	t.Setenv("EMAIL_VERIFICATION_KEY", "test-email-verification-key-with-enough-length")
	t.Setenv("EMAIL_PROVIDER", "console")
	withoutEnvironment(t, "DATABASE_URL")
	t.Setenv("DATABASE_PASSWORD_FILE", filepath.Join(t.TempDir(), "missing"))

	_, err := LoadFrom(filepath.Join(t.TempDir(), "missing.env"))
	if err == nil || !strings.Contains(err.Error(), "DATABASE_PASSWORD_FILE") {
		t.Fatalf("expected invalid database password file error, got %v", err)
	}
}

func withoutEnvironment(t *testing.T, key string) {
	t.Helper()
	value, existed := os.LookupEnv(key)
	if err := os.Unsetenv(key); err != nil {
		t.Fatalf("unset %s: %v", key, err)
	}
	t.Cleanup(func() {
		if existed {
			_ = os.Setenv(key, value)
			return
		}
		_ = os.Unsetenv(key)
	})
}
