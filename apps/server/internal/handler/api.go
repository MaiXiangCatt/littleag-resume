package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/model"
)

type APIHandler struct {
	*AnalyticsHandler
	*AuthHandler
	*ResumeHandler
}

func NewAPIHandler(
	auth *AuthHandler,
	resume *ResumeHandler,
	analyticsHandlers ...*AnalyticsHandler,
) *APIHandler {
	var analytics *AnalyticsHandler
	if len(analyticsHandlers) > 0 {
		analytics = analyticsHandlers[0]
	}
	return &APIHandler{
		AnalyticsHandler: analytics,
		AuthHandler:      auth,
		ResumeHandler:    resume,
	}
}

func GeneratedErrorHandler(c *gin.Context, _ error, _ int) {
	c.JSON(http.StatusBadRequest, model.Fail(model.ErrInvalidParam))
}
