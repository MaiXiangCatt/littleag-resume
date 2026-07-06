package main

import (
	"context"
	"log"

	"github.com/vega-resume/server/internal/config"
	"github.com/vega-resume/server/internal/handler"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/server"
	"github.com/vega-resume/server/internal/service"
)

func main() {
	cfg := config.Load()
	db, err := repository.OpenPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("database handle: %v", err)
	}
	defer sqlDB.Close()
	if err := repository.Migrate(context.Background(), db); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	store := repository.NewGormStore(db)
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
