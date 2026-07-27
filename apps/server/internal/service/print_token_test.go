package service

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
)

func TestPrintTokenConsumeIsSingleUse(t *testing.T) {
	svc := NewPrintTokenService(time.Minute)
	userID := uuid.New()
	resumeID := uuid.New()

	token, err := svc.Issue(userID, resumeID)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	gotUser, gotResume, err := svc.Consume(token)
	if err != nil {
		t.Fatalf("consume: %v", err)
	}
	if gotUser != userID || gotResume != resumeID {
		t.Fatalf("claims mismatch: got user=%s resume=%s", gotUser, gotResume)
	}
	if _, _, err := svc.Consume(token); !errors.Is(err, model.ErrTokenInvalid) {
		t.Fatalf("second consume should fail, got %v", err)
	}
}

func TestPrintTokenExpired(t *testing.T) {
	svc := NewPrintTokenService(time.Minute)
	token, err := svc.Issue(uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	svc.now = func() time.Time { return time.Now().Add(2 * time.Minute) }
	if _, _, err := svc.Consume(token); !errors.Is(err, model.ErrTokenExpired) {
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
	if _, _, err := svc.Consume(tampered); !errors.Is(err, model.ErrTokenInvalid) {
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
	if _, _, err := verifier.Consume(token); !errors.Is(err, model.ErrTokenInvalid) {
		t.Fatalf("want ErrTokenInvalid, got %v", err)
	}
}

func TestPrintTokenConcurrentConsumeOnlySucceedsOnce(t *testing.T) {
	svc := NewPrintTokenService(time.Minute)
	token, err := svc.Issue(uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	var successes atomic.Int32
	var wait sync.WaitGroup
	for range 8 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			if _, _, consumeErr := svc.Consume(token); consumeErr == nil {
				successes.Add(1)
			}
		}()
	}
	wait.Wait()

	if successes.Load() != 1 {
		t.Fatalf("want exactly one successful consume, got %d", successes.Load())
	}
}
