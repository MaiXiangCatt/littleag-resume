package middleware

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/generated"
	"github.com/vega-resume/server/internal/model"
)

const currentUserContextKey = "auth.currentUser"

type AccessTokenValidator interface {
	ValidateAccessToken(ctx context.Context, token string) (*model.AuthUser, error)
}

func Authenticate(validator AccessTokenValidator) generated.MiddlewareFunc {
	return func(c *gin.Context) {
		if _, protected := c.Get(string(generated.BearerAuthScopes)); !protected {
			return
		}
		const prefix = "Bearer "
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, prefix) {
			writeMiddlewareError(c, model.ErrUnauthorized)
			return
		}
		user, err := validator.ValidateAccessToken(c.Request.Context(), strings.TrimSpace(strings.TrimPrefix(header, prefix)))
		if err != nil {
			var appErr *model.AppError
			if typed, ok := err.(*model.AppError); ok {
				appErr = typed
			} else {
				appErr = model.ErrUnauthorized
			}
			writeMiddlewareError(c, appErr)
			return
		}
		c.Set(currentUserContextKey, user)
	}
}

func CurrentUserID(c *gin.Context) (uuid.UUID, bool) {
	user, ok := CurrentUser(c)
	if !ok {
		return uuid.Nil, false
	}
	userID, err := uuid.Parse(user.ID)
	return userID, err == nil
}

func CurrentUser(c *gin.Context) (*model.AuthUser, bool) {
	value, ok := c.Get(currentUserContextKey)
	if !ok {
		return nil, false
	}
	user, ok := value.(*model.AuthUser)
	if !ok {
		return nil, false
	}
	return user, true
}

func writeMiddlewareError(c *gin.Context, err *model.AppError) {
	c.AbortWithStatusJSON(err.HTTPStatus, model.Fail(err))
}
