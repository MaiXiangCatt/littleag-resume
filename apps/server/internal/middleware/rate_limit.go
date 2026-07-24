package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/model"
)

type ipBucket struct {
	count      int
	windowEnds time.Time
}

const maxIPBuckets = 50_000

type ipRateLimiter struct {
	mu          sync.Mutex
	buckets     map[string]ipBucket
	limit       int
	window      time.Duration
	maxBuckets  int
	nextCleanup time.Time
}

func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	limiter := newIPRateLimiter(limit, window, maxIPBuckets, time.Now().UTC())

	return func(c *gin.Context) {
		if !limiter.allow(c.ClientIP(), time.Now().UTC()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, model.Fail(model.ErrTooManyRequests))
			return
		}
		c.Next()
	}
}

func newIPRateLimiter(limit int, window time.Duration, bucketLimit int, now time.Time) *ipRateLimiter {
	if limit <= 0 {
		limit = 120
	}
	if window <= 0 {
		window = time.Minute
	}
	if bucketLimit <= 0 {
		bucketLimit = maxIPBuckets
	}
	return &ipRateLimiter{
		buckets:     make(map[string]ipBucket),
		limit:       limit,
		window:      window,
		maxBuckets:  bucketLimit,
		nextCleanup: now.Add(window),
	}
}

func (l *ipRateLimiter) allow(ip string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	if !now.Before(l.nextCleanup) {
		for key, candidate := range l.buckets {
			if !candidate.windowEnds.After(now) {
				delete(l.buckets, key)
			}
		}
		l.nextCleanup = now.Add(l.window)
	}

	bucket, exists := l.buckets[ip]
	if exists && !bucket.windowEnds.After(now) {
		bucket = ipBucket{windowEnds: now.Add(l.window)}
	}
	if !exists && len(l.buckets) >= l.maxBuckets {
		return false
	}
	if !exists {
		bucket = ipBucket{windowEnds: now.Add(l.window)}
	}
	bucket.count++
	l.buckets[ip] = bucket
	return bucket.count <= l.limit
}
