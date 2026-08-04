package main

import (
	"context"
	"log"
	"time"

	"github.com/vega-resume/server/internal/config"
	"github.com/vega-resume/server/internal/handler"
	"github.com/vega-resume/server/internal/mailer"
	"github.com/vega-resume/server/internal/middleware"
	"github.com/vega-resume/server/internal/model"
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
	analyticsService := service.NewAnalyticsService(service.AnalyticsServiceConfig{
		Enabled: cfg.AnalyticsEnabled,
		HashKey: cfg.AnalyticsHashKey,
		Store:   store,
	})
	if err := analyticsService.Cleanup(context.Background()); err != nil {
		log.Fatalf("cleanup analytics: %v", err)
	}
	cleanupContext, stopCleanup := context.WithCancel(context.Background())
	defer stopCleanup()
	go runAnalyticsCleanup(cleanupContext, analyticsService)
	invitationChallenges := make([]service.InvitationChallenge, 0, len(cfg.InvitationChallenges))
	for _, challenge := range cfg.InvitationChallenges {
		invitationChallenges = append(invitationChallenges, service.InvitationChallenge{
			ID: challenge.ID, Prompt: challenge.Prompt, Answer: challenge.Answer,
		})
	}
	invitationService := service.NewInvitationService(service.InvitationServiceConfig{
		Mode:        model.RegistrationMode(cfg.RegistrationMode),
		Challenges:  invitationChallenges,
		Invitations: store,
	})
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
		RegistrationInvitations:   store,
		RegistrationMode:          model.RegistrationMode(cfg.RegistrationMode),
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
		LoginFailureCapacity:      cfg.LoginFailureCapacity,
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
		handler.NewAuthHandler(authService, invitationService, cfg.Environment == "prod"),
		handler.NewResumeHandler(handler.ResumeHandlerConfig{
			Resumes:     resumeService,
			Renderer:    renderer,
			PrintTokens: service.NewPrintTokenService(cfg.PrintTokenTTL),
			WebBaseURL:  cfg.WebBaseURL,
		}),
		handler.NewAnalyticsHandler(analyticsService, cfg.AnalyticsOrigins),
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

func runAnalyticsCleanup(ctx context.Context, analytics *service.AnalyticsService) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := analytics.Cleanup(ctx); err != nil {
				log.Printf("cleanup analytics: %v", err)
			}
		}
	}
}
