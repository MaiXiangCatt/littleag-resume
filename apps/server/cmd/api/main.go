package main

import (
	"database/sql"
	"log"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/vega-resume/server/internal/config"
	"github.com/vega-resume/server/internal/handler"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/server"
	"github.com/vega-resume/server/internal/service"
)

func main() {
	cfg := config.Load()
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()

	store := repository.NewPostgresStore(db)
	authService := service.NewAuthService(service.AuthServiceConfig{
		Users:            store,
		RefreshTokens:    store,
		AccessTokenKey:   cfg.AccessTokenKey,
		AccessTokenTTL:   cfg.AccessTokenTTL,
		RefreshTokenTTL:  cfg.RefreshTokenTTL,
		AccountLockLimit: cfg.AccountLockLimit,
		AccountLockTTL:   cfg.AccountLockTTL,
	})
	router := server.NewRouter(handler.NewAuthHandler(authService))
	if err := router.Run(cfg.Addr); err != nil {
		log.Fatalf("run server: %v", err)
	}
}
