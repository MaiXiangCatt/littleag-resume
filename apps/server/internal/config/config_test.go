package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadFromRequiresAccessTokenKey(t *testing.T) {
	withoutEnvironment(t, "ACCESS_TOKEN_KEY")

	_, err := LoadFrom(filepath.Join(t.TempDir(), "missing.env"))
	if err == nil || !strings.Contains(err.Error(), "ACCESS_TOKEN_KEY") {
		t.Fatalf("expected missing ACCESS_TOKEN_KEY error, got %v", err)
	}
}

func TestLoadFromDotEnvWithoutOverridingEnvironment(t *testing.T) {
	withoutEnvironment(t, "ACCESS_TOKEN_KEY")
	t.Setenv("SERVER_ADDR", ":9090")

	dotenvPath := filepath.Join(t.TempDir(), ".env")
	contents := "ACCESS_TOKEN_KEY=local-development-secret-with-32-bytes\nSERVER_ADDR=:7070\n"
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

func TestLoadUsesDotEnvFromWorkingDirectory(t *testing.T) {
	withoutEnvironment(t, "ACCESS_TOKEN_KEY")
	workingDirectory := t.TempDir()
	dotenvPath := filepath.Join(workingDirectory, ".env")
	if err := os.WriteFile(dotenvPath, []byte("ACCESS_TOKEN_KEY=working-directory-secret-with-32-bytes\n"), 0o600); err != nil {
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
