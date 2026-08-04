package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/service"
)

type analyticsStoreSpy struct {
	deletedHash string
	event       *model.AnalyticsEvent
}

func (s *analyticsStoreSpy) RecordAnalyticsEvent(
	_ context.Context,
	event *model.AnalyticsEvent,
	_ int,
) (repository.AnalyticsRecordResult, error) {
	s.event = event
	return repository.AnalyticsRecordInserted, nil
}

func (s *analyticsStoreSpy) DeleteAnalyticsInstallation(
	_ context.Context,
	visitorHash string,
) error {
	s.deletedHash = visitorHash
	return nil
}

func (s *analyticsStoreSpy) CleanupAnalytics(context.Context, time.Time) error {
	return nil
}

func TestAnalyticsServiceHashesInstallationAndNeverPassesRawIDToStore(t *testing.T) {
	store := &analyticsStoreSpy{}
	now := time.Date(2026, time.August, 1, 12, 0, 0, 0, time.UTC)
	analytics := service.NewAnalyticsService(service.AnalyticsServiceConfig{
		Enabled: true,
		HashKey: []byte("independent-analytics-test-key-32-bytes"),
		Now:     func() time.Time { return now },
		Store:   store,
	})
	installationID := uuid.MustParse("58b30f6e-ab68-4cfc-b62e-3665729e4f52")
	eventID := uuid.MustParse("7d569f9c-d05b-4c79-8614-1ae01347d54a")

	result, err := analytics.Record(context.Background(), service.RecordAnalyticsInput{
		InstallationID: installationID,
		EventID:        eventID,
		EventName:      "resume_created",
		Mode:           "local",
		ConsentVersion: "1",
	})
	if err != nil {
		t.Fatalf("record analytics: %v", err)
	}
	if result != repository.AnalyticsRecordInserted {
		t.Fatalf("unexpected record result %q", result)
	}
	if store.event == nil {
		t.Fatal("expected event to reach repository")
	}
	if store.event.VisitorHash == installationID.String() ||
		len(store.event.VisitorHash) != 64 {
		t.Fatalf("visitor hash must be a sha256 hex digest, got %q", store.event.VisitorHash)
	}
	if store.event.EventID != eventID || !store.event.RecordedAt.Equal(now) {
		t.Fatalf("event metadata mismatch: %#v", store.event)
	}

	if err := analytics.Delete(context.Background(), installationID); err != nil {
		t.Fatalf("delete analytics: %v", err)
	}
	if store.deletedHash != store.event.VisitorHash {
		t.Fatalf("record and deletion must derive the same HMAC")
	}
}

func TestAnalyticsServiceRejectsNonV4IdentifiersAndUnknownEnums(t *testing.T) {
	store := &analyticsStoreSpy{}
	analytics := service.NewAnalyticsService(service.AnalyticsServiceConfig{
		Enabled: true,
		HashKey: []byte("independent-analytics-test-key-32-bytes"),
		Store:   store,
	})
	validID := uuid.MustParse("58b30f6e-ab68-4cfc-b62e-3665729e4f52")
	testCases := []service.RecordAnalyticsInput{
		{InstallationID: uuid.NewMD5(uuid.Nil, nil), EventID: uuid.New(), EventName: "resume_created", Mode: "local", ConsentVersion: "1"},
		{InstallationID: validID, EventID: uuid.New(), EventName: "page_view", Mode: "local", ConsentVersion: "1"},
		{InstallationID: validID, EventID: uuid.New(), EventName: "resume_created", Mode: "desktop", ConsentVersion: "1"},
		{InstallationID: validID, EventID: uuid.New(), EventName: "resume_created", Mode: "local", ConsentVersion: "2"},
	}
	for _, input := range testCases {
		if _, err := analytics.Record(context.Background(), input); err == nil {
			t.Fatalf("expected validation error for %#v", input)
		}
	}
	if store.event != nil {
		t.Fatal("invalid analytics must not reach repository")
	}
}
