package repository

import (
	"strings"
	"sync"
	"testing"

	"gorm.io/gorm/schema"

	"github.com/vega-resume/server/internal/model"
)

func TestAnalyticsMigrationKeepsForeignKeyOnEvents(t *testing.T) {
	eventSchema, err := schema.Parse(
		&model.AnalyticsEvent{},
		&sync.Map{},
		schema.NamingStrategy{},
	)
	if err != nil {
		t.Fatalf("parse analytics event schema: %v", err)
	}
	if len(eventSchema.Relationships.Relations) != 0 {
		t.Fatalf(
			"analytics event model must not define inferred relationships: %#v",
			eventSchema.Relationships.Relations,
		)
	}

	statement := strings.Join(strings.Fields(analyticsEventInstallationConstraint), " ")
	for _, required := range []string{
		"ALTER TABLE analytics_events",
		"FOREIGN KEY (visitor_hash)",
		"REFERENCES analytics_installations(visitor_hash)",
		"ON DELETE CASCADE",
	} {
		if !strings.Contains(statement, required) {
			t.Errorf("analytics foreign key migration missing %q", required)
		}
	}
	if strings.Contains(statement, "ALTER TABLE analytics_installations") {
		t.Fatal("analytics foreign key must not be owned by analytics_installations")
	}
}
