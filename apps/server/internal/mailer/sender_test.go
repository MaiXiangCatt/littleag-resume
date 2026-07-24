package mailer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestResendSenderSendsConfiguredVerificationEmail(t *testing.T) {
	var received resendEmailRequest
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer test-api-key" {
			t.Errorf("Authorization = %q", request.Header.Get("Authorization"))
		}
		if request.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Content-Type = %q", request.Header.Get("Content-Type"))
		}
		if err := json.NewDecoder(request.Body).Decode(&received); err != nil {
			t.Errorf("decode request: %v", err)
		}
		response.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	sender := &ResendSender{
		apiKey:      "test-api-key",
		from:        "Resume <verify@example.com>",
		productName: "New Product",
		client:      server.Client(),
		endpoint:    server.URL,
	}
	if err := sender.SendVerificationCode(
		context.Background(),
		"user@example.com",
		"012345",
		10*time.Minute,
	); err != nil {
		t.Fatalf("send verification code: %v", err)
	}

	if received.From != "Resume <verify@example.com>" ||
		len(received.To) != 1 ||
		received.To[0] != "user@example.com" {
		t.Fatalf("unexpected envelope: %+v", received)
	}
	if !strings.Contains(received.Subject, "New Product") ||
		!strings.Contains(received.Text, "012345") ||
		!strings.Contains(received.HTML, "10 分钟") {
		t.Fatalf("unexpected message: %+v", received)
	}
}

func TestResendSenderReturnsProviderFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		http.Error(response, "provider unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	sender := &ResendSender{
		apiKey:   "test-api-key",
		from:     "verify@example.com",
		client:   server.Client(),
		endpoint: server.URL,
	}
	err := sender.SendVerificationCode(
		context.Background(),
		"user@example.com",
		"012345",
		10*time.Minute,
	)
	if err == nil || !strings.Contains(err.Error(), "status 503") {
		t.Fatalf("error = %v, want provider status", err)
	}
}

func TestNewVerificationSenderValidatesProviderConfiguration(t *testing.T) {
	if _, err := NewVerificationSender(Config{Provider: "resend"}); err == nil {
		t.Fatal("resend provider should require an API key and sender")
	}
	if _, err := NewVerificationSender(Config{Provider: "unknown"}); err == nil {
		t.Fatal("unknown provider should be rejected")
	}
	if _, err := NewVerificationSender(Config{Provider: "console", ProductName: "Local"}); err != nil {
		t.Fatalf("console provider: %v", err)
	}
}
