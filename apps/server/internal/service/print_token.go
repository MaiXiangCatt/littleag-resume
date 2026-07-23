package service

import (
	"crypto/rand"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
)

const printTokenPurpose = "resume-print"

type printClaims struct {
	jwt.RegisteredClaims
	ResumeID string `json:"rid"`
	Purpose  string `json:"purpose"`
}

// PrintTokenService issues short-lived, single-resume tokens that authorize the
// headless print page. The signing key is generated per process, so tokens are
// only valid against the instance that issued them.
type PrintTokenService struct {
	key []byte
	ttl time.Duration
	now func() time.Time
}

func NewPrintTokenService(ttl time.Duration) *PrintTokenService {
	if ttl <= 0 {
		ttl = 90 * time.Second
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		panic("print token key: " + err.Error())
	}
	return &PrintTokenService{key: key, ttl: ttl, now: time.Now}
}

func (s *PrintTokenService) Issue(userID, resumeID uuid.UUID) (string, error) {
	now := s.now()
	claims := printClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
		},
		ResumeID: resumeID.String(),
		Purpose:  printTokenPurpose,
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.key)
	if err != nil {
		return "", model.ErrInternalServer
	}
	return signed, nil
}

func (s *PrintTokenService) Validate(tokenString string) (userID, resumeID uuid.UUID, err error) {
	claims := &printClaims{}
	token, parseErr := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, model.ErrTokenInvalid
		}
		return s.key, nil
	}, jwt.WithTimeFunc(func() time.Time { return s.now() }))
	if parseErr != nil {
		if errors.Is(parseErr, jwt.ErrTokenExpired) {
			return uuid.Nil, uuid.Nil, model.ErrTokenExpired
		}
		return uuid.Nil, uuid.Nil, model.ErrTokenInvalid
	}
	if !token.Valid || claims.Purpose != printTokenPurpose {
		return uuid.Nil, uuid.Nil, model.ErrTokenInvalid
	}
	userID, err = uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, uuid.Nil, model.ErrTokenInvalid
	}
	resumeID, err = uuid.Parse(claims.ResumeID)
	if err != nil {
		return uuid.Nil, uuid.Nil, model.ErrTokenInvalid
	}
	return userID, resumeID, nil
}
