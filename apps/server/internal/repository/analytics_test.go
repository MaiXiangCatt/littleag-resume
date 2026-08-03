package repository_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
)

func TestAnalyticsRepositoryIsIdempotentAggregatesAndDeletesDetail(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:analytics-repository?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.AnalyticsInstallation{},
		&model.AnalyticsEvent{},
		&model.AnalyticsDailyAggregate{},
	); err != nil {
		t.Fatalf("migrate analytics: %v", err)
	}
	if err := db.Exec(
		`CREATE UNIQUE INDEX analytics_workspace_test_uidx ON analytics_events (visitor_hash) WHERE event_name = 'workspace_activated'`,
	).Error; err != nil {
		t.Fatalf("create workspace index: %v", err)
	}

	store := repository.NewGormStore(db)
	now := time.Date(2026, time.August, 1, 10, 0, 0, 0, time.UTC)
	eventID := uuid.New()
	event := &model.AnalyticsEvent{
		EventID: eventID, VisitorHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		EventName: "workspace_activated", Mode: "local", RecordedAt: now,
	}
	result, err := store.RecordAnalyticsEvent(context.Background(), event, 100)
	if err != nil || result != repository.AnalyticsRecordInserted {
		t.Fatalf("insert event: result=%q err=%v", result, err)
	}
	result, err = store.RecordAnalyticsEvent(context.Background(), event, 100)
	if err != nil || result != repository.AnalyticsRecordDuplicate {
		t.Fatalf("duplicate event: result=%q err=%v", result, err)
	}
	secondWorkspace := *event
	secondWorkspace.EventID = uuid.New()
	result, err = store.RecordAnalyticsEvent(context.Background(), &secondWorkspace, 100)
	if err != nil || result != repository.AnalyticsRecordDuplicate {
		t.Fatalf("workspace uniqueness: result=%q err=%v", result, err)
	}

	var aggregate model.AnalyticsDailyAggregate
	if err := db.First(&aggregate).Error; err != nil {
		t.Fatalf("load aggregate: %v", err)
	}
	if aggregate.Count != 1 {
		t.Fatalf("idempotent aggregate count = %d, want 1", aggregate.Count)
	}

	if err := store.DeleteAnalyticsInstallation(context.Background(), event.VisitorHash); err != nil {
		t.Fatalf("delete installation: %v", err)
	}
	var eventCount, aggregateCount int64
	db.Model(&model.AnalyticsEvent{}).Count(&eventCount)
	db.Model(&model.AnalyticsDailyAggregate{}).Count(&aggregateCount)
	if eventCount != 0 || aggregateCount != 1 {
		t.Fatalf("delete detail should retain aggregate, events=%d aggregates=%d", eventCount, aggregateCount)
	}
}

func TestAnalyticsRepositoryQuotaAndCleanup(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:analytics-cleanup?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.AnalyticsInstallation{},
		&model.AnalyticsEvent{},
		&model.AnalyticsDailyAggregate{},
	); err != nil {
		t.Fatalf("migrate analytics: %v", err)
	}
	store := repository.NewGormStore(db)
	now := time.Date(2026, time.August, 1, 10, 0, 0, 0, time.UTC)
	hash := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

	for index := 0; index < 2; index++ {
		result, err := store.RecordAnalyticsEvent(context.Background(), &model.AnalyticsEvent{
			EventID: uuid.New(), VisitorHash: hash, EventName: "resume_created",
			Mode: "cloud", RecordedAt: now.Add(time.Duration(index) * time.Minute),
		}, 1)
		if err != nil {
			t.Fatalf("record quota event %d: %v", index, err)
		}
		expected := repository.AnalyticsRecordInserted
		if index == 1 {
			expected = repository.AnalyticsRecordQuota
		}
		if result != expected {
			t.Fatalf("quota event %d result=%q want=%q", index, result, expected)
		}
	}

	oldHash := "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
	if err := db.Create(&model.AnalyticsInstallation{
		VisitorHash: oldHash,
		FirstSeenAt: now.AddDate(-2, 0, 0),
		LastSeenAt:  now.AddDate(-2, 0, 0),
	}).Error; err != nil {
		t.Fatalf("insert old installation: %v", err)
	}
	if err := store.CleanupAnalytics(context.Background(), now); err != nil {
		t.Fatalf("cleanup analytics: %v", err)
	}
	var oldCount int64
	db.Model(&model.AnalyticsInstallation{}).Where("visitor_hash = ?", oldHash).Count(&oldCount)
	if oldCount != 0 {
		t.Fatal("inactive installation should be deleted")
	}
}
