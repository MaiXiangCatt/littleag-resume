package model

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey"`
	Username        string     `gorm:"type:text;not null"`
	Email           string     `gorm:"type:text;not null"`
	EmailNormalized string     `gorm:"type:text;not null"`
	PasswordHash    string     `gorm:"type:text;not null"`
	CreatedAt       time.Time  `gorm:"not null;autoCreateTime"`
	UpdatedAt       time.Time  `gorm:"not null;autoUpdateTime"`
	DeletedAt       *time.Time `gorm:"index"`
}

type RefreshToken struct {
	ID                uuid.UUID  `gorm:"type:uuid;primaryKey"`
	UserID            uuid.UUID  `gorm:"type:uuid;not null;index:idx_refresh_tokens_user_id"`
	TokenHash         string     `gorm:"type:text;not null;uniqueIndex:idx_refresh_tokens_token_hash"`
	ExpiresAt         time.Time  `gorm:"not null"`
	RevokedAt         *time.Time `gorm:"index"`
	ReplacedByTokenID *uuid.UUID `gorm:"type:uuid"`
	CreatedAt         time.Time  `gorm:"not null;autoCreateTime"`
	User              *User      `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
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
