package model

import (
	"time"

	"github.com/google/uuid"
)

type RegistrationMode string

const (
	RegistrationModeOpen   RegistrationMode = "open"
	RegistrationModeInvite RegistrationMode = "invite"
	RegistrationModeClosed RegistrationMode = "closed"
)

type User struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey"`
	Username        string     `gorm:"type:text;not null"`
	Email           string     `gorm:"type:text;not null"`
	EmailNormalized string     `gorm:"type:text;not null"`
	PasswordHash    string     `gorm:"type:text;not null"`
	EmailVerifiedAt *time.Time `gorm:"index"`
	CreatedAt       time.Time  `gorm:"not null;autoCreateTime"`
	UpdatedAt       time.Time  `gorm:"not null;autoUpdateTime"`
	DeletedAt       *time.Time `gorm:"index"`
}

type EmailVerificationChallenge struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserID        uuid.UUID `gorm:"type:uuid;not null;index"`
	CodeMAC       string    `gorm:"type:char(64);not null"`
	Attempts      int       `gorm:"not null;default:0"`
	ExpiresAt     time.Time `gorm:"not null;index"`
	SentAt        *time.Time
	ConsumedAt    *time.Time `gorm:"index"`
	InvalidatedAt *time.Time `gorm:"index"`
	CreatedAt     time.Time  `gorm:"not null;autoCreateTime"`
	User          *User      `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
}

type RegistrationEmailVerification struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey"`
	Email           string    `gorm:"type:text;not null"`
	EmailNormalized string    `gorm:"type:text;not null;index"`
	CodeMAC         string    `gorm:"type:char(64);not null"`
	Attempts        int       `gorm:"not null;default:0"`
	ExpiresAt       time.Time `gorm:"not null;index"`
	SentAt          *time.Time
	ConsumedAt      *time.Time `gorm:"index"`
	InvalidatedAt   *time.Time `gorm:"index"`
	CreatedAt       time.Time  `gorm:"not null;autoCreateTime"`
}

type RegistrationInvitation struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"`
	CodeHash   string     `gorm:"type:char(64);not null;uniqueIndex"`
	ExpiresAt  time.Time  `gorm:"not null;index"`
	ConsumedAt *time.Time `gorm:"index"`
	CreatedAt  time.Time  `gorm:"not null;autoCreateTime"`
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
	ID            string `json:"id"`
	Username      string `json:"username"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"emailVerified"`
}

type AuthPayload struct {
	AccessToken string   `json:"accessToken"`
	User        AuthUser `json:"user"`
}

func NewAuthUser(user *User) AuthUser {
	return AuthUser{
		ID:            user.ID.String(),
		Username:      user.Username,
		Email:         user.Email,
		EmailVerified: user.EmailVerifiedAt != nil,
	}
}
