package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
)

var (
	ErrNotFound          = errors.New("repository: not found")
	ErrDuplicateEmail    = errors.New("repository: duplicate email")
	ErrDuplicateUsername = errors.New("repository: duplicate username")
)

type UserRepository interface {
	CreateUser(ctx context.Context, user *model.User) error
	FindActiveUserByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	FindActiveUserByEmailNormalized(ctx context.Context, emailNormalized string) (*model.User, error)
	FindActiveUserByUsername(ctx context.Context, username string) (*model.User, error)
}

type RefreshTokenRepository interface {
	CreateRefreshToken(ctx context.Context, token *model.RefreshToken) error
	FindActiveRefreshTokenByHash(ctx context.Context, tokenHash string) (*model.RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, id uuid.UUID, replacementID *uuid.UUID, revokedAt time.Time) error
}
