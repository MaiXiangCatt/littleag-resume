package middleware

import (
	"testing"
	"time"
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
