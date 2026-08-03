package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"text/tabwriter"
	"time"

	"gorm.io/gorm"

	"github.com/vega-resume/server/internal/config"
	"github.com/vega-resume/server/internal/repository"
)

type eventReportRow struct {
	EventName string
	Mode      string
	Last7     int64
	Last30    int64
	AllTime   int64
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	db, err := repository.OpenPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("database handle: %v", err)
	}
	defer sqlDB.Close()

	if err := writeReport(context.Background(), db, time.Now().UTC()); err != nil {
		log.Fatalf("analytics report: %v", err)
	}
}

func writeReport(ctx context.Context, db *gorm.DB, now time.Time) error {
	currentInstallations, err := count(ctx, db, `SELECT COUNT(*) FROM analytics_installations`)
	if err != nil {
		return err
	}
	activatedInstallations, err := count(
		ctx,
		db,
		`SELECT COALESCE(SUM(count), 0) FROM analytics_daily_aggregates WHERE event_name = 'workspace_activated'`,
	)
	if err != nil {
		return err
	}
	active1, err := activeInstallations(ctx, db, now.Add(-24*time.Hour))
	if err != nil {
		return err
	}
	active7, err := activeInstallations(ctx, db, now.AddDate(0, 0, -7))
	if err != nil {
		return err
	}
	active30, err := activeInstallations(ctx, db, now.AddDate(0, 0, -30))
	if err != nil {
		return err
	}

	registered, err := count(ctx, db, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`)
	if err != nil {
		return err
	}
	verified, err := count(
		ctx,
		db,
		`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND email_verified_at IS NOT NULL`,
	)
	if err != nil {
		return err
	}
	cloudResumeAccounts, err := count(ctx, db, `SELECT COUNT(DISTINCT user_id) FROM resumes`)
	if err != nil {
		return err
	}
	cloudExports, err := count(ctx, db, `SELECT COALESCE(SUM(export_count), 0) FROM resumes`)
	if err != nil {
		return err
	}

	var events []eventReportRow
	start7 := dateOnly(now.AddDate(0, 0, -6))
	start30 := dateOnly(now.AddDate(0, 0, -29))
	if err := db.WithContext(ctx).Raw(`
		SELECT event_name, mode,
			COALESCE(SUM(count) FILTER (WHERE day >= ?), 0) AS last7,
			COALESCE(SUM(count) FILTER (WHERE day >= ?), 0) AS last30,
			COALESCE(SUM(count), 0) AS all_time
		FROM analytics_daily_aggregates
		GROUP BY event_name, mode
		ORDER BY event_name, mode
	`, start7, start30).Scan(&events).Error; err != nil {
		return err
	}

	writer := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(writer, "ANONYMOUS INSTALLATIONS\tCOUNT")
	fmt.Fprintf(writer, "current\t%d\n", currentInstallations)
	fmt.Fprintf(writer, "activated all-time\t%d\n", activatedInstallations)
	fmt.Fprintf(writer, "active last 1 day\t%d\n", active1)
	fmt.Fprintf(writer, "active last 7 days\t%d\n", active7)
	fmt.Fprintf(writer, "active last 30 days\t%d\n", active30)
	fmt.Fprintln(writer)
	fmt.Fprintln(writer, "EVENT\tMODE\t7 DAYS\t30 DAYS\tALL-TIME")
	for _, row := range events {
		fmt.Fprintf(
			writer,
			"%s\t%s\t%d\t%d\t%d\n",
			row.EventName,
			row.Mode,
			row.Last7,
			row.Last30,
			row.AllTime,
		)
	}
	fmt.Fprintln(writer)
	fmt.Fprintln(writer, "OPERATIONAL METRIC\tCOUNT")
	fmt.Fprintf(writer, "registered accounts\t%d\n", registered)
	fmt.Fprintf(writer, "verified accounts\t%d\n", verified)
	fmt.Fprintf(writer, "accounts that created cloud resumes\t%d\n", cloudResumeAccounts)
	fmt.Fprintf(writer, "cloud resume exports\t%d\n", cloudExports)
	return writer.Flush()
}

func count(ctx context.Context, db *gorm.DB, query string, args ...any) (int64, error) {
	var value int64
	err := db.WithContext(ctx).Raw(query, args...).Scan(&value).Error
	return value, err
}

func activeInstallations(ctx context.Context, db *gorm.DB, since time.Time) (int64, error) {
	return count(
		ctx,
		db,
		`SELECT COUNT(DISTINCT visitor_hash) FROM analytics_events WHERE recorded_at >= ?`,
		since,
	)
}

func dateOnly(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}
