package main

import (
	"context"
	"log"

	"github.com/vega-resume/server/internal/config"
	"github.com/vega-resume/server/internal/handler"
	"github.com/vega-resume/server/internal/mailer"
	"github.com/vega-resume/server/internal/middleware"
	"github.com/vega-resume/server/internal/pdf"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/server"
	"github.com/vega-resume/server/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
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
	verificationEmailSender, err := mailer.NewVerificationSender(mailer.Config{
		Provider:     cfg.EmailProvider,
		ResendAPIKey: cfg.ResendAPIKey,
		From:         cfg.MailFrom,
		ProductName:  cfg.EmailProductName,
	})
	if err != nil {
		log.Fatalf("configure verification email sender: %v", err)
	}
	authService := service.NewAuthService(service.AuthServiceConfig{
		Users:                     store,
		EmailVerifications:        store,
		RegistrationVerifications: store,
		RefreshTokens:             store,
		VerificationEmailSender:   verificationEmailSender,
		EmailVerificationKey:      cfg.EmailVerificationKey,
		EmailVerificationTTL:      cfg.EmailVerificationTTL,
		EmailVerificationLimit:    cfg.EmailVerificationLimit,
		EmailResendCooldown:       cfg.EmailResendCooldown,
		AccessTokenKey:            cfg.AccessTokenKey,
		AccessTokenTTL:            cfg.AccessTokenTTL,
		RefreshTokenTTL:           cfg.RefreshTokenTTL,
		AccountLockLimit:          cfg.AccountLockLimit,
		AccountLockTTL:            cfg.AccountLockTTL,
	})
	resumeService := service.NewResumeService(service.ResumeServiceConfig{Resumes: store, AvatarDir: cfg.AvatarStorageDir})
	renderer := pdf.NewChromeRenderer(pdf.Config{
		ExecPath:    cfg.ChromeExecPath,
		RemoteURL:   cfg.ChromeRemoteURL,
		Timeout:     cfg.PdfRenderTimeout,
		Concurrency: cfg.PdfMaxConcurrency,
		MaxQueue:    cfg.PdfMaxQueue,
	})
	defer renderer.Close()
	apiHandler := handler.NewAPIHandler(
		handler.NewAuthHandler(authService),
		handler.NewResumeHandler(handler.ResumeHandlerConfig{
			Resumes:     resumeService,
			Renderer:    renderer,
			PrintTokens: service.NewPrintTokenService(cfg.PrintTokenTTL),
			WebBaseURL:  cfg.WebBaseURL,
		}),
	)
	router, err := server.NewRouter(
		apiHandler,
		cfg.TrustedProxies,
		middleware.Authenticate(authService),
	)
	if err != nil {
		log.Fatalf("configure trusted proxies: %v", err)
	}
	if err := router.Run(cfg.Addr); err != nil {
		log.Fatalf("run server: %v", err)
	}
}
