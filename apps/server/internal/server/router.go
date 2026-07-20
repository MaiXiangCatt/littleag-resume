package server

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/generated"
	"github.com/vega-resume/server/internal/handler"
	"github.com/vega-resume/server/internal/middleware"
)

func NewRouter(authHandler *handler.AuthHandler) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RateLimit(120, time.Minute))
	generated.RegisterHandlers(router, authHandler)
	return router
}
