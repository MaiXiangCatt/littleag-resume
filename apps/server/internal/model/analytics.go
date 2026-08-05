package model

import (
	"time"

	"github.com/google/uuid"
)

type AnalyticsInstallation struct {
	VisitorHash string    `gorm:"type:char(64);primaryKey"`
	FirstSeenAt time.Time `gorm:"not null;index"`
	LastSeenAt  time.Time `gorm:"not null;index"`
}

type AnalyticsEvent struct {
	EventID     uuid.UUID `gorm:"type:uuid;primaryKey"`
	VisitorHash string    `gorm:"type:char(64);not null;index:idx_analytics_events_visitor_recorded,priority:1"`
	EventName   string    `gorm:"type:varchar(40);not null;index"`
	Mode        string    `gorm:"type:varchar(8);not null;index"`
	RecordedAt  time.Time `gorm:"not null;index:idx_analytics_events_visitor_recorded,priority:2;index"`
}

type AnalyticsDailyAggregate struct {
	Day       time.Time `gorm:"type:date;primaryKey"`
	EventName string    `gorm:"type:varchar(40);primaryKey"`
	Mode      string    `gorm:"type:varchar(8);primaryKey"`
	Count     int64     `gorm:"not null;default:0"`
}
