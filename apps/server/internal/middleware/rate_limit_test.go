package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestIPRateLimiterCountsWithinAWindow(t *testing.T) {
	now := time.Date(2026, 7, 24, 12, 0, 0, 0, time.UTC)
	limiter := newIPRateLimiter(2, time.Minute, 10, now)

	if !limiter.allow("192.0.2.1", now) || !limiter.allow("192.0.2.1", now) {
		t.Fatal("requests within the configured limit should pass")
	}
	if limiter.allow("192.0.2.1", now) {
		t.Fatal("request above the configured limit should be rejected")
	}
	if !limiter.allow("192.0.2.1", now.Add(time.Minute)) {
		t.Fatal("a new window should reset the bucket")
	}
}

func TestAnalyticsRateLimitOnlyAppliesToAnalyticsWrites(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(AnalyticsRateLimit(1, time.Minute))
	router.POST("/api/analytics/events", func(c *gin.Context) { c.Status(http.StatusAccepted) })
	router.GET("/api/analytics/config", func(c *gin.Context) { c.Status(http.StatusOK) })

	first := httptest.NewRecorder()
	router.ServeHTTP(first, httptest.NewRequest(http.MethodPost, "/api/analytics/events", nil))
	second := httptest.NewRecorder()
	router.ServeHTTP(second, httptest.NewRequest(http.MethodPost, "/api/analytics/events", nil))
	config := httptest.NewRecorder()
	router.ServeHTTP(config, httptest.NewRequest(http.MethodGet, "/api/analytics/config", nil))

	if first.Code != http.StatusAccepted || second.Code != http.StatusTooManyRequests {
		t.Fatalf("analytics write rate limit got first=%d second=%d", first.Code, second.Code)
	}
	if config.Code != http.StatusOK {
		t.Fatalf("analytics config must not use the write limiter, got %d", config.Code)
	}
}

func TestIPRateLimiterCleansExpiredBuckets(t *testing.T) {
	now := time.Date(2026, 7, 24, 12, 0, 0, 0, time.UTC)
	limiter := newIPRateLimiter(2, time.Minute, 10, now)

	limiter.allow("192.0.2.1", now)
	limiter.allow("192.0.2.2", now)
	if len(limiter.buckets) != 2 {
		t.Fatalf("bucket count = %d, want 2", len(limiter.buckets))
	}

	limiter.allow("192.0.2.3", now.Add(time.Minute))
	if len(limiter.buckets) != 1 {
		t.Fatalf("expired buckets were not cleaned: %+v", limiter.buckets)
	}
}

func TestIPRateLimiterRejectsNewIPsAtCapacity(t *testing.T) {
	now := time.Date(2026, 7, 24, 12, 0, 0, 0, time.UTC)
	limiter := newIPRateLimiter(2, time.Minute, 2, now)

	if !limiter.allow("192.0.2.1", now) || !limiter.allow("192.0.2.2", now) {
		t.Fatal("requests should fill the bounded bucket map")
	}
	if limiter.allow("192.0.2.3", now) {
		t.Fatal("an unseen IP should be rejected when the map is full")
	}
	if len(limiter.buckets) != 2 {
		t.Fatalf("bucket count = %d, want bounded size 2", len(limiter.buckets))
	}
}
