package model

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID              uuid.UUID
	Username        string
	Email           string
	EmailNormalized string
	PasswordHash    string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       *time.Time
}

type RefreshToken struct {
	ID                uuid.UUID
	UserID            uuid.UUID
	TokenHash         string
	ExpiresAt         time.Time
	RevokedAt         *time.Time
	ReplacedByTokenID *uuid.UUID
	CreatedAt         time.Time
}

type AuthUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type AuthPayload struct {
	AccessToken string   `json:"accessToken"`
	User        AuthUser `json:"user"`
}

func NewAuthUser(user *User) AuthUser {
	return AuthUser{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
	}
}
