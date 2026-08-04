package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/model"
)

func AnalyticsRateLimit(limit int, window time.Duration) gin.HandlerFunc {
	limiter := newIPRateLimiter(limit, window, maxIPBuckets, time.Now().UTC())

	return func(c *gin.Context) {
		if c.Request.Method != http.MethodPost ||
			!strings.HasPrefix(c.Request.URL.Path, "/api/analytics/") {
			c.Next()
			return
		}
		if !limiter.allow(c.ClientIP(), time.Now().UTC()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, model.Fail(model.ErrTooManyRequests))
			return
		}
		c.Next()
	}
}
