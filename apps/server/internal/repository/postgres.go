package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/vega-resume/server/internal/model"
)

type GormStore struct {
	db *gorm.DB
}

func OpenPostgres(databaseURL string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
}

func NewGormStore(db *gorm.DB) *GormStore {
	return &GormStore{db: db}
}

func Migrate(ctx context.Context, db *gorm.DB) error {
	gdb := db.WithContext(ctx)
	if err := gdb.AutoMigrate(&model.User{}, &model.RefreshToken{}); err != nil {
		return err
	}
	for _, statement := range []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uidx ON users (email_normalized) WHERE deleted_at IS NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_uidx ON users (username) WHERE deleted_at IS NULL`,
	} {
		if err := gdb.Exec(statement).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *GormStore) CreateUser(ctx context.Context, user *model.User) error {
	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		return mapUserCreateError(err)
	}
	return nil
}

func (s *GormStore) FindActiveUserByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	var user model.User
	if err := s.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", id).
		First(&user).Error; err != nil {
		return nil, mapNotFound(err)
	}
	return &user, nil
}

func (s *GormStore) FindActiveUserByEmailNormalized(ctx context.Context, emailNormalized string) (*model.User, error) {
	var user model.User
	if err := s.db.WithContext(ctx).
		Where("email_normalized = ? AND deleted_at IS NULL", emailNormalized).
		First(&user).Error; err != nil {
		return nil, mapNotFound(err)
	}
	return &user, nil
}

func (s *GormStore) FindActiveUserByUsername(ctx context.Context, username string) (*model.User, error) {
	var user model.User
	if err := s.db.WithContext(ctx).
		Where("username = ? AND deleted_at IS NULL", username).
		First(&user).Error; err != nil {
		return nil, mapNotFound(err)
	}
	return &user, nil
}

func (s *GormStore) CreateRefreshToken(ctx context.Context, token *model.RefreshToken) error {
	return s.db.WithContext(ctx).Create(token).Error
}

func (s *GormStore) FindActiveRefreshTokenByHash(ctx context.Context, tokenHash string) (*model.RefreshToken, error) {
	var token model.RefreshToken
	if err := s.db.WithContext(ctx).
		Where("token_hash = ? AND revoked_at IS NULL", tokenHash).
		First(&token).Error; err != nil {
		return nil, mapNotFound(err)
	}
	return &token, nil
}

func (s *GormStore) RevokeRefreshToken(ctx context.Context, id uuid.UUID, replacementID *uuid.UUID, revokedAt time.Time) error {
	result := s.db.WithContext(ctx).
		Model(&model.RefreshToken{}).
		Where("id = ? AND revoked_at IS NULL", id).
		Updates(map[string]any{
			"revoked_at":           revokedAt,
			"replaced_by_token_id": replacementID,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func mapNotFound(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrNotFound
	}
	return err
}

func mapUserCreateError(err error) error {
	if isUniqueConstraint(err, "users_email_active_uidx", "users.email_normalized") {
		return ErrDuplicateEmail
	}
	if isUniqueConstraint(err, "users_username_active_uidx", "users.username") {
		return ErrDuplicateUsername
	}
	return err
}

func isUniqueConstraint(err error, identifiers ...string) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		for _, identifier := range identifiers {
			if pgErr.ConstraintName == identifier {
				return true
			}
		}
		return false
	}

	message := strings.ToLower(err.Error())
	for _, identifier := range identifiers {
		if strings.Contains(message, strings.ToLower(identifier)) {
			return true
		}
	}
	return false
}
