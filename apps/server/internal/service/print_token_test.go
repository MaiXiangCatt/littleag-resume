package service

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
)

func TestPrintTokenRoundTrip(t *testing.T) {
	svc := NewPrintTokenService(time.Minute)
	userID := uuid.New()
	resumeID := uuid.New()

	token, err := svc.Issue(userID, resumeID)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	gotUser, gotResume, err := svc.Validate(token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if gotUser != userID || gotResume != resumeID {
		t.Fatalf("claims mismatch: got user=%s resume=%s", gotUser, gotResume)
	}
}

func TestPrintTokenExpired(t *testing.T) {
	svc := NewPrintTokenService(time.Minute)
	token, err := svc.Issue(uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	svc.now = func() time.Time { return time.Now().Add(2 * time.Minute) }
	if _, _, err := svc.Validate(token); !errors.Is(err, model.ErrTokenExpired) {
		t.Fatalf("want ErrTokenExpired, got %v", err)
	}
}

func TestPrintTokenTampered(t *testing.T) {
	svc := NewPrintTokenService(time.Minute)
	token, err := svc.Issue(uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	tampered := token[:len(token)-2] + "xx"
	if _, _, err := svc.Validate(tampered); !errors.Is(err, model.ErrTokenInvalid) {
		t.Fatalf("want ErrTokenInvalid, got %v", err)
	}
}

func TestPrintTokenRejectsOtherInstanceKey(t *testing.T) {
	issuer := NewPrintTokenService(time.Minute)
	verifier := NewPrintTokenService(time.Minute)
	token, err := issuer.Issue(uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, _, err := verifier.Validate(token); !errors.Is(err, model.ErrTokenInvalid) {
		t.Fatalf("want ErrTokenInvalid, got %v", err)
	}
}

func TestPrintTokenRejectsMissingPurpose(t *testing.T) {
	svc := NewPrintTokenService(time.Minute)
	claims := printClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   uuid.NewString(),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
		ResumeID: uuid.NewString(),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(svc.key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if _, _, err := svc.Validate(token); !errors.Is(err, model.ErrTokenInvalid) {
		t.Fatalf("want ErrTokenInvalid, got %v", err)
	}
}
