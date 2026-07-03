package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
)

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) CreateUser(ctx context.Context, user *model.User) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO users (id, username, email, email_normalized, password_hash, created_at, updated_at, deleted_at)
		VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), COALESCE($7, now()), $8)
	`, user.ID, user.Username, user.Email, user.EmailNormalized, user.PasswordHash, user.CreatedAt, user.UpdatedAt, user.DeletedAt)
	return err
}

func (s *PostgresStore) FindActiveUserByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	return s.scanUser(s.db.QueryRowContext(ctx, `
		SELECT id, username, email, email_normalized, password_hash, created_at, updated_at, deleted_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, id))
}

func (s *PostgresStore) FindActiveUserByEmailNormalized(ctx context.Context, emailNormalized string) (*model.User, error) {
	return s.scanUser(s.db.QueryRowContext(ctx, `
		SELECT id, username, email, email_normalized, password_hash, created_at, updated_at, deleted_at
		FROM users
		WHERE email_normalized = $1 AND deleted_at IS NULL
	`, emailNormalized))
}

func (s *PostgresStore) FindActiveUserByUsername(ctx context.Context, username string) (*model.User, error) {
	return s.scanUser(s.db.QueryRowContext(ctx, `
		SELECT id, username, email, email_normalized, password_hash, created_at, updated_at, deleted_at
		FROM users
		WHERE username = $1 AND deleted_at IS NULL
	`, username))
}

func (s *PostgresStore) scanUser(row *sql.Row) (*model.User, error) {
	var user model.User
	var deletedAt sql.NullTime
	if err := row.Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.EmailNormalized,
		&user.PasswordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
		&deletedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if deletedAt.Valid {
		user.DeletedAt = &deletedAt.Time
	}
	return &user, nil
}

func (s *PostgresStore) CreateRefreshToken(ctx context.Context, token *model.RefreshToken) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, replaced_by_token_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
	`, token.ID, token.UserID, token.TokenHash, token.ExpiresAt, token.RevokedAt, token.ReplacedByTokenID, token.CreatedAt)
	return err
}

func (s *PostgresStore) FindActiveRefreshTokenByHash(ctx context.Context, tokenHash string) (*model.RefreshToken, error) {
	var token model.RefreshToken
	var revokedAt sql.NullTime
	var replacedBy sql.NullString
	if err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, token_hash, expires_at, revoked_at, replaced_by_token_id, created_at
		FROM refresh_tokens
		WHERE token_hash = $1 AND revoked_at IS NULL
	`, tokenHash).Scan(
		&token.ID,
		&token.UserID,
		&token.TokenHash,
		&token.ExpiresAt,
		&revokedAt,
		&replacedBy,
		&token.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if revokedAt.Valid {
		token.RevokedAt = &revokedAt.Time
	}
	if replacedBy.Valid {
		id, err := uuid.Parse(replacedBy.String)
		if err != nil {
			return nil, err
		}
		token.ReplacedByTokenID = &id
	}
	return &token, nil
}

func (s *PostgresStore) RevokeRefreshToken(ctx context.Context, id uuid.UUID, replacementID *uuid.UUID, revokedAt time.Time) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE refresh_tokens
		SET revoked_at = $2, replaced_by_token_id = $3
		WHERE id = $1 AND revoked_at IS NULL
	`, id, revokedAt, replacementID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}
