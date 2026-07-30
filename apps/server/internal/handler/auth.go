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

const (
	refreshTokenCookieName       = "refresh_token"
	maxAuthBodyBytes       int64 = 16 << 10
)

type AuthHandler struct {
	auth          *service.AuthService
	invitations   *service.InvitationService
	secureCookies bool
}

func NewAuthHandler(
	auth *service.AuthService,
	invitations *service.InvitationService,
	secureCookies bool,
) *AuthHandler {
	return &AuthHandler{auth: auth, invitations: invitations, secureCookies: secureCookies}
}

func (h *AuthHandler) GetAuthRegistrationPolicy(c *gin.Context) {
	policy := h.invitations.Policy()
	c.JSON(http.StatusOK, model.OK(generated.RegistrationPolicyPayload{
		ChallengeAvailable: policy.ChallengeAvailable,
		Mode:               generated.RegistrationMode(policy.Mode),
	}))
}

func (h *AuthHandler) GetAuthInvitationChallenge(c *gin.Context) {
	payload, err := h.invitations.RandomChallenge()
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, model.OK(generated.InvitationChallengePayload{
		ChallengeId: payload.ChallengeID,
		Prompt:      payload.Prompt,
	}))
}

func (h *AuthHandler) AnswerAuthInvitationChallenge(c *gin.Context) {
	var body generated.AnswerAuthInvitationChallengeJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxAuthBodyBytes); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}
	payload, err := h.invitations.AnswerChallenge(
		c.Request.Context(),
		c.ClientIP(),
		body.ChallengeId,
		body.Answer,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, model.OK(generated.InvitationCodePayload{
		ExpiresInSeconds: int(payload.ExpiresIn / time.Second),
		InvitationCode:   payload.InvitationCode,
	}))
}

func (h *AuthHandler) RegisterAuthUser(c *gin.Context) {
	var body generated.RegisterAuthUserJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxAuthBodyBytes); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}

	payload, refreshToken, err := h.auth.Register(c.Request.Context(), service.RegisterInput{
		Username:         body.Username,
		Email:            string(body.Email),
		Password:         body.Password,
		ConfirmPassword:  body.ConfirmPassword,
		VerificationCode: body.VerificationCode,
		InvitationCode:   stringValue(body.InvitationCode),
	})
	if err != nil {
		writeError(c, err)
		return
	}
	h.setRefreshCookie(c, refreshToken, 7*24*time.Hour)
	c.JSON(http.StatusOK, model.OK(payload))
}

func (h *AuthHandler) SendAuthRegistrationEmailVerification(c *gin.Context) {
	var body generated.SendAuthRegistrationEmailVerificationJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxAuthBodyBytes); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}
	payload, err := h.auth.SendRegistrationEmailVerification(
		c.Request.Context(),
		string(body.Email),
		stringValue(body.InvitationCode),
	)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, model.OK(payload))
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (h *AuthHandler) ConfirmAuthEmailVerification(c *gin.Context) {
	var body generated.ConfirmAuthEmailVerificationJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxAuthBodyBytes); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}
	payload, refreshToken, err := h.auth.ConfirmEmailVerification(
		c.Request.Context(),
		service.ConfirmEmailVerificationInput{
			Email: string(body.Email),
			Code:  body.Code,
		},
	)
	if err != nil {
		writeError(c, err)
		return
	}
	h.setRefreshCookie(c, refreshToken, 7*24*time.Hour)
	c.JSON(http.StatusOK, model.OK(payload))
}

func (h *AuthHandler) ResendAuthEmailVerification(c *gin.Context) {
	var body generated.ResendAuthEmailVerificationJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxAuthBodyBytes); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}
	payload, err := h.auth.ResendEmailVerification(
		c.Request.Context(),
		service.ResendEmailVerificationInput{
			Email:    string(body.Email),
			Password: body.Password,
		},
	)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, model.OK(payload))
}

func (h *AuthHandler) LoginAuthUser(c *gin.Context) {
	var body generated.LoginAuthUserJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxAuthBodyBytes); err != nil {
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
	h.setRefreshCookie(c, refreshToken, 7*24*time.Hour)
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
	h.setRefreshCookie(c, refreshToken, 7*24*time.Hour)
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
	h.clearRefreshCookie(c)
	c.JSON(http.StatusOK, model.OK[any](nil))
}

func bearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}

func (h *AuthHandler) setRefreshCookie(c *gin.Context, value string, ttl time.Duration) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(refreshTokenCookieName, value, int(ttl.Seconds()), "/api/auth", "", h.secureCookies, true)
}

func (h *AuthHandler) clearRefreshCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(refreshTokenCookieName, "", -1, "/api/auth", "", h.secureCookies, true)
}

func bindJSONWithLimit(c *gin.Context, destination any, limit int64) error {
	if c.Request.ContentLength > limit {
		return &http.MaxBytesError{Limit: limit}
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
	return c.ShouldBindJSON(destination)
}

func writeError(c *gin.Context, err error) {
	var appErr *model.AppError
	if !errors.As(err, &appErr) {
		appErr = model.ErrInternalServer
	}
	c.JSON(appErr.HTTPStatus, model.Fail(appErr))
}
