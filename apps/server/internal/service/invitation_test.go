package service

import (
	"bytes"
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
)

func TestInvitationServiceAnswersNormalizedChallengeAndAppliesIPCooldown(t *testing.T) {
	ctx := context.Background()
	store := repository.NewMemoryStore()
	now := time.Date(2026, 7, 30, 8, 0, 0, 0, time.UTC)
	randomBytes := make([]byte, 256)
	for index := range randomBytes {
		randomBytes[index] = byte(index + index/16)
	}
	invitations := NewInvitationService(InvitationServiceConfig{
		Mode: model.RegistrationModeInvite,
		Challenges: []InvitationChallenge{{
			ID:     "yi-ci-lin-qing",
			Prompt: "异次临倾，",
			Answer: "步步唯银",
		}},
		Invitations: store,
		Now:         func() time.Time { return now },
		Random:      bytes.NewReader(randomBytes),
	})

	policy := invitations.Policy()
	if policy.Mode != model.RegistrationModeInvite || !policy.ChallengeAvailable {
		t.Fatalf("unexpected policy: %+v", policy)
	}
	challenge, err := invitations.RandomChallenge()
	if err != nil {
		t.Fatalf("random challenge: %v", err)
	}
	if challenge.ChallengeID != "yi-ci-lin-qing" || challenge.Prompt != "异次临倾，" {
		t.Fatalf("unexpected challenge: %+v", challenge)
	}

	issued, err := invitations.AnswerChallenge(ctx, "203.0.113.1", challenge.ChallengeID, " 步步，ＷＥＩ银！ ")
	if !errors.Is(err, model.ErrInvitationAnswerWrong) {
		t.Fatalf("different normalized answer should be rejected, got payload=%+v err=%v", issued, err)
	}
	issued, err = invitations.AnswerChallenge(ctx, "203.0.113.1", challenge.ChallengeID, "　步步，唯银！ ")
	if err != nil {
		t.Fatalf("answer challenge: %v", err)
	}
	if matched := regexp.MustCompile(`^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$`).MatchString(issued.InvitationCode); !matched {
		t.Fatalf("unexpected invitation format %q", issued.InvitationCode)
	}
	if issued.ExpiresIn != 30*time.Minute {
		t.Fatalf("unexpected invitation ttl %s", issued.ExpiresIn)
	}
	codeHash, ok := registrationInvitationCodeHash(
		" " + issued.InvitationCode[:4] + " " + issued.InvitationCode[5:] + " ",
	)
	if !ok || codeHash == issued.InvitationCode {
		t.Fatalf("invitation should normalize and hash")
	}
	stored, err := store.FindActiveRegistrationInvitationByCodeHash(ctx, codeHash, now)
	if err != nil {
		t.Fatalf("find stored invitation: %v", err)
	}
	if stored.CodeHash != codeHash {
		t.Fatalf("stored invitation must only contain the code hash")
	}

	if _, err := invitations.AnswerChallenge(
		ctx,
		"203.0.113.1",
		challenge.ChallengeID,
		"步步唯银",
	); !errors.Is(err, model.ErrTooManyRequests) {
		t.Fatalf("expected same-ip cooldown, got %v", err)
	}
	if _, err := invitations.AnswerChallenge(
		ctx,
		"203.0.113.2",
		challenge.ChallengeID,
		"步步唯银",
	); err != nil {
		t.Fatalf("different ip should be allowed: %v", err)
	}

	now = now.Add(30 * time.Minute)
	if _, err := invitations.AnswerChallenge(
		ctx,
		"203.0.113.1",
		challenge.ChallengeID,
		"步步唯银",
	); err != nil {
		t.Fatalf("expired cooldown should allow another invitation: %v", err)
	}
	if _, err := store.FindActiveRegistrationInvitationByCodeHash(
		ctx,
		codeHash,
		now,
	); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("expired invitation must not remain active, got %v", err)
	}
}

func TestInvitationServiceDoesNotExposeChallengesWhenClosed(t *testing.T) {
	invitations := NewInvitationService(InvitationServiceConfig{
		Mode: model.RegistrationModeClosed,
		Challenges: []InvitationChallenge{{
			ID: "hidden", Prompt: "hidden", Answer: "hidden",
		}},
		Invitations: repository.NewMemoryStore(),
	})

	if invitations.Policy().ChallengeAvailable {
		t.Fatal("closed mode must hide challenge availability")
	}
	if _, err := invitations.RandomChallenge(); !errors.Is(err, model.ErrRegistrationClosed) {
		t.Fatalf("expected registration closed, got %v", err)
	}
}

func TestNormalizeInvitationAnswer(t *testing.T) {
	if got := normalizeInvitationAnswer(" ＢｕＧ，　不如就春风！ "); got != "bug不如就春风" {
		t.Fatalf("unexpected normalized answer %q", got)
	}
}
