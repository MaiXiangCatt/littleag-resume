package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/generated"
	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/service"
)

const refreshTokenCookieName = "refresh_token"

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

func (h *AuthHandler) RegisterAuthUser(c *gin.Context) {
	var body generated.RegisterAuthUserJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}

	payload, refreshToken, err := h.auth.Register(c.Request.Context(), service.RegisterInput{
		Username:        body.Username,
		Email:           string(body.Email),
		Password:        body.Password,
		ConfirmPassword: body.ConfirmPassword,
	})
	if err != nil {
		writeError(c, err)
		return
	}
	setRefreshCookie(c, refreshToken, 7*24*time.Hour)
	c.JSON(http.StatusOK, model.OK(payload))
}

func (h *AuthHandler) LoginAuthUser(c *gin.Context) {
	var body generated.LoginAuthUserJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}

	payload, refreshToken, err := h.auth.Login(c.Request.Context(), service.LoginInput{
		Email:    string(body.Email),
		Password: body.Password,
	})
	if err != nil {
		writeError(c, err)
		return
	}
	setRefreshCookie(c, refreshToken, 7*24*time.Hour)
	c.JSON(http.StatusOK, model.OK(payload))
}

func (h *AuthHandler) GetCurrentAuthUser(c *gin.Context) {
	token := bearerToken(c.GetHeader("Authorization"))
	if token == "" {
		writeError(c, model.ErrUnauthorized)
		return
	}

	user, err := h.auth.ValidateAccessToken(c.Request.Context(), token)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, model.OK(user))
}

func (h *AuthHandler) RefreshAuthSession(c *gin.Context, params generated.RefreshAuthSessionParams) {
	if params.RefreshToken == nil {
		writeError(c, model.ErrRefreshTokenInvalid)
		return
	}

	payload, refreshToken, err := h.auth.Refresh(c.Request.Context(), string(*params.RefreshToken))
	if err != nil {
		writeError(c, err)
		return
	}
	setRefreshCookie(c, refreshToken, 7*24*time.Hour)
	c.JSON(http.StatusOK, model.OK(payload))
}

func (h *AuthHandler) LogoutAuthUser(c *gin.Context, params generated.LogoutAuthUserParams) {
	refreshToken := ""
	if params.RefreshToken != nil {
		refreshToken = string(*params.RefreshToken)
	}
	if err := h.auth.Logout(c.Request.Context(), refreshToken); err != nil {
		writeError(c, err)
		return
	}
	clearRefreshCookie(c)
	c.JSON(http.StatusOK, model.OK[any](nil))
}

func bearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}

func setRefreshCookie(c *gin.Context, value string, ttl time.Duration) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(refreshTokenCookieName, value, int(ttl.Seconds()), "/api/auth", "", false, true)
}

func clearRefreshCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(refreshTokenCookieName, "", -1, "/api/auth", "", false, true)
}

func writeError(c *gin.Context, err error) {
	var appErr *model.AppError
	if !errors.As(err, &appErr) {
		appErr = model.ErrInternalServer
	}
	c.JSON(appErr.HTTPStatus, model.Fail(appErr))
}
