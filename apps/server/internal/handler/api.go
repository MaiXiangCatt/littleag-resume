package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/model"
)

type APIHandler struct {
	*AuthHandler
	*ResumeHandler
}

func NewAPIHandler(auth *AuthHandler, resume *ResumeHandler) *APIHandler {
	return &APIHandler{AuthHandler: auth, ResumeHandler: resume}
}

func GeneratedErrorHandler(c *gin.Context, _ error, _ int) {
	c.JSON(http.StatusBadRequest, model.Fail(model.ErrInvalidParam))
}
