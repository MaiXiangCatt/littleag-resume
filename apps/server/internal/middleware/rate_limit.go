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

func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	if limit <= 0 {
		limit = 120
	}
	if window <= 0 {
		window = time.Minute
	}

	var mu sync.Mutex
	buckets := map[string]ipBucket{}

	return func(c *gin.Context) {
		now := time.Now().UTC()
		ip := c.ClientIP()

		mu.Lock()
		bucket := buckets[ip]
		if bucket.windowEnds.Before(now) {
			bucket = ipBucket{windowEnds: now.Add(window)}
		}
		bucket.count++
		buckets[ip] = bucket
		blocked := bucket.count > limit
		mu.Unlock()

		if blocked {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, model.Fail(model.ErrTooManyRequests))
			return
		}
		c.Next()
	}
}
