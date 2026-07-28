package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/generated"
	"github.com/vega-resume/server/internal/handler"
	"github.com/vega-resume/server/internal/middleware"
)

func NewRouter(
	apiHandler generated.ServerInterface,
	trustedProxies []string,
	middlewares ...generated.MiddlewareFunc,
) (*gin.Engine, error) {
	router := gin.New()
	if err := router.SetTrustedProxies(trustedProxies); err != nil {
		return nil, err
	}
	router.Use(gin.Recovery())
	router.Use(middleware.RateLimit(120, time.Minute))
	router.GET("/api/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	generated.RegisterHandlersWithOptions(router, apiHandler, generated.GinServerOptions{
		Middlewares:  middlewares,
		ErrorHandler: handler.GeneratedErrorHandler,
	})
	return router, nil
}
