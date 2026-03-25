package app

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/hi-ai/gateway/internal/adapter"
	openaiAdapter "github.com/hi-ai/gateway/internal/adapter/openai"
	"github.com/hi-ai/gateway/internal/config"
	"github.com/hi-ai/gateway/internal/domain"
	"github.com/hi-ai/gateway/internal/handler"
	"github.com/hi-ai/gateway/internal/handler/admin"
	"github.com/hi-ai/gateway/internal/handler/auth"
	"github.com/hi-ai/gateway/internal/handler/webhook"
	v1 "github.com/hi-ai/gateway/internal/handler/v1"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/payment"
	"github.com/hi-ai/gateway/internal/repository/postgres"
	"github.com/hi-ai/gateway/internal/service"
)

// App holds all application dependencies.
type App struct {
	Config               *config.Config
	Logger               *slog.Logger
	DB                   *postgres.DB
	Registry             *adapter.Registry
	TenantRepo           *postgres.TenantRepository
	UserRepo             *postgres.UserRepository
	APIKeyRepo           *postgres.APIKeyRepository
	AuditRepo            *postgres.AuditRepository
	ProviderConfigRepo   *postgres.ProviderConfigRepository
	BillingRepo          *postgres.BillingRepository
	RedisClient          *service.RedisClient
	HealthTracker        *service.HealthTracker
	ChatSvc              *service.ChatService
	UserSvc              *service.UserService
	APIKeySvc            *service.APIKeyService
	BillingSvc           *service.BillingService
	ChatHandler          *v1.ChatHandler
	JWTChatHandler       *admin.JWTChatHandler
	ModelsHandler        *v1.ModelsHandler
	HealthHandler        *handler.HealthHandler
	AuthHandler          *auth.AuthHandler
	AuditLogger          *middleware.AuditLogger
	AuditHandler         *admin.AuditHandler
	KeysHandler          *admin.KeysHandler
	TenantHandler        *admin.TenantHandler
	ProfileHandler       *admin.ProfileHandler
	ProvidersHandler     *admin.ProvidersHandler
	BillingHandler       *admin.BillingHandler
	ManagementHandler    *admin.ManagementHandler
	WebhookHandler       *webhook.PaymentHandler
	PaymentProviders     map[string]payment.PaymentProvider
	// New admin handlers
	SecurityHandler      *admin.SecurityHandler
	RoutingHandler       *admin.RoutingHandler
	PaymentsHandler      *admin.PaymentsHandler
	APIKeysAdminHandler  *admin.APIKeysAdminHandler
	// Infrastructure
	Guardrail            *middleware.Guardrail
	BreakerPool          *middleware.BreakerPool
}

// New creates and wires all application dependencies.
func New(cfg *config.Config) (*App, error) {
	// Initialize logger
	logLevel := slog.LevelInfo
	switch cfg.Log.Level {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))

	// Initialize database connection
	ctx := context.Background()
	db, err := postgres.NewDB(ctx, cfg.Database.DSN())
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}
	logger.Info("connected to database")

	// Initialize Redis client for rate limiting
	redisClient, err := service.NewRedisClient(cfg.Redis, logger)
	if err != nil {
		logger.Warn("failed to initialize Redis client", "error", err)
		// Don't fail startup - rate limiting will fail-open
	}

	// Initialize repositories
	tenantRepo := postgres.NewTenantRepository(db)
	userRepo := postgres.NewUserRepository(db)
	apiKeyRepo := postgres.NewAPIKeyRepository(db)
	auditRepo := postgres.NewAuditRepository(db)
	providerConfigRepo := postgres.NewProviderConfigRepository(db)
	billingRepo := postgres.NewBillingRepository(db)

	// Initialize adapter registry
	registry := adapter.NewRegistry()

	// Register enabled providers
	for _, p := range cfg.Providers {
		if !p.Enabled || p.APIKey == "" {
			continue
		}
		// All providers use OpenAI-compatible API, register with their unique ID
		registry.Register(openaiAdapter.New(p.ID, p.BaseURL, p.APIKey, p.Models))
		if len(p.Models) > 0 {
			logger.Info("registered provider", "id", p.ID, "name", p.Name, "models", p.Models)
		} else {
			logger.Info("registered provider (supports all models)", "id", p.ID, "name", p.Name)
		}
	}

	logger.Info("registered providers", "count", len(registry.List()), "providers", registry.List())

	// Initialize health tracker for routing
	healthWindow, err := time.ParseDuration(cfg.Routing.HealthCheck.Window)
	if err != nil {
		healthWindow = 5 * time.Minute // Default fallback
		logger.Warn("invalid health check window, using default", "error", err, "default", "5m")
	}
	healthTracker := service.NewHealthTracker(healthWindow, cfg.Routing.HealthCheck.ErrorThreshold)

	// Determine routing mode
	routingMode := domain.RoutingMode(cfg.Routing.Mode)
	logger.Info("routing configuration", "mode", routingMode, "health_window", healthWindow, "error_threshold", cfg.Routing.HealthCheck.ErrorThreshold)

	// Initialize retryer for exponential backoff
	retryConfig := service.RetryConfig{
		MaxAttempts:       cfg.Retry.MaxAttempts,
		InitialBackoff:    cfg.Retry.InitialBackoff,
		MaxBackoff:        cfg.Retry.MaxBackoff,
		BackoffMultiplier: cfg.Retry.BackoffMultiplier,
	}
	retryer := service.NewRetryer(retryConfig, logger)

	// Initialize circuit breaker pool
	breakerConfig := middleware.BreakerConfig{
		FailureThreshold: uint32(cfg.CircuitBreaker.FailureThreshold),
		SuccessThreshold: uint32(cfg.CircuitBreaker.SuccessThreshold),
		Timeout:          cfg.CircuitBreaker.Timeout,
		Window:           cfg.CircuitBreaker.Window,
	}
	breakerPool := middleware.NewBreakerPool(breakerConfig)

	// Initialize services
	billingSvc := service.NewBillingService(billingRepo)
	chatSvc := service.NewChatService(registry, logger, healthTracker, routingMode, billingSvc, retryer, breakerPool)
	userSvc := service.NewUserService(userRepo, tenantRepo, cfg.Auth.JWTSecret, cfg.Auth.AccessTokenTTL, cfg.Auth.RefreshTokenTTL, billingSvc)
	apiKeySvc := service.NewAPIKeyService()

	// Initialize handlers
	chatHandler := v1.NewChatHandler(chatSvc)
	jwtChatHandler := admin.NewJWTChatHandler(chatSvc)
	modelsHandler := v1.NewModelsHandler(registry)
	healthHandler := handler.NewHealthHandler()
	authHandler := auth.NewAuthHandler(userSvc, cfg.Auth.JWTSecret)

	// Initialize audit logging
	auditLogger := middleware.NewAuditLogger(auditRepo, logger)
	auditHandler := admin.NewAuditHandler(auditRepo, logger)

	// Initialize admin handlers
	keysHandler := admin.NewKeysHandler(apiKeySvc, apiKeyRepo, logger)
	tenantHandler := admin.NewTenantHandler(tenantRepo, logger)
	profileHandler := admin.NewProfileHandler(userRepo, userSvc, logger)
	providersHandler := admin.NewProvidersHandler(providerConfigRepo, logger)

	// Initialize payment providers
	paymentProviders := make(map[string]payment.PaymentProvider)
	if cfg.Payment.Stripe.SecretKey != "" {
		paymentProviders["stripe"] = payment.NewStripeProvider(cfg.Payment.Stripe.SecretKey, cfg.Payment.Stripe.WebhookSecret)
		logger.Info("stripe payment provider initialized")
	}
	if cfg.Payment.Alipay.AppID != "" {
		paymentProviders["alipay"] = payment.NewAlipayProvider(cfg.Payment.Alipay.AppID, cfg.Payment.Alipay.PrivateKey)
		logger.Info("alipay payment provider initialized (placeholder)")
	}
	if cfg.Payment.Wechat.AppID != "" && cfg.Payment.Wechat.MchID != "" {
		paymentProviders["wechat"] = payment.NewWechatProvider(cfg.Payment.Wechat.AppID, cfg.Payment.Wechat.MchID, cfg.Payment.Wechat.APIKey)
		logger.Info("wechat payment provider initialized (placeholder)")
	}

	// Initialize guardrail for PII protection
	guardrail := middleware.NewGuardrail(logger)

	// Initialize billing handler with payment providers
	baseURL := fmt.Sprintf("http://%s:%d", cfg.Server.Host, cfg.Server.Port)
	if cfg.Server.Host == "0.0.0.0" {
		baseURL = fmt.Sprintf("http://localhost:%d", cfg.Server.Port)
	}
	billingHandler := admin.NewBillingHandler(billingSvc, paymentProviders, baseURL, logger)
	managementHandler := admin.NewManagementHandler(userRepo, billingRepo, logger)
	webhookHandler := webhook.NewPaymentHandler(billingSvc, logger)

	// Initialize new admin handlers
	securityHandler := admin.NewSecurityHandler(guardrail, logger)
	routingHandler := admin.NewRoutingHandler(cfg, breakerPool, logger)
	paymentsHandler := admin.NewPaymentsHandler(billingRepo, logger)
	apiKeysAdminHandler := admin.NewAPIKeysAdminHandler(apiKeyRepo, logger)

	app := &App{
		Config:             cfg,
		Logger:             logger,
		DB:                 db,
		Registry:           registry,
		TenantRepo:         tenantRepo,
		UserRepo:           userRepo,
		APIKeyRepo:         apiKeyRepo,
		AuditRepo:          auditRepo,
		ProviderConfigRepo: providerConfigRepo,
		BillingRepo:        billingRepo,
		RedisClient:        redisClient,
		HealthTracker:      healthTracker,
		ChatSvc:            chatSvc,
		UserSvc:            userSvc,
		APIKeySvc:          apiKeySvc,
		BillingSvc:         billingSvc,
		ChatHandler:        chatHandler,
		JWTChatHandler:     jwtChatHandler,
		ModelsHandler:      modelsHandler,
		HealthHandler:      healthHandler,
		AuthHandler:        authHandler,
		AuditLogger:        auditLogger,
		AuditHandler:       auditHandler,
		KeysHandler:        keysHandler,
		TenantHandler:      tenantHandler,
		ProfileHandler:     profileHandler,
		ProvidersHandler:   providersHandler,
		BillingHandler:     billingHandler,
		ManagementHandler:  managementHandler,
		WebhookHandler:     webhookHandler,
		PaymentProviders:   paymentProviders,
		// New admin handlers
		SecurityHandler:     securityHandler,
		RoutingHandler:      routingHandler,
		PaymentsHandler:     paymentsHandler,
		APIKeysAdminHandler: apiKeysAdminHandler,
		// Infrastructure
		Guardrail:           guardrail,
		BreakerPool:         breakerPool,
	}

	return app, nil
}

// Run starts the HTTP server.
func (a *App) Run() error {
	server := NewServer(a)
	addr := a.Config.Address()
	a.Logger.Info("starting WuguHub gateway", "address", addr)
	return server.Listen(addr)
}

// Shutdown gracefully shuts down the application.
func (a *App) Shutdown() error {
	a.Logger.Info("shutting down WuguHub gateway")

	// Close database connection
	if a.DB != nil {
		a.DB.Close()
		a.Logger.Info("database connection closed")
	}

	// Close Redis connection
	if a.RedisClient != nil {
		if err := a.RedisClient.Close(); err != nil {
			a.Logger.Warn("failed to close Redis connection", "error", err)
		} else {
			a.Logger.Info("redis connection closed")
		}
	}

	return nil
}

func init() {
	// Ensure stdout is line-buffered for container environments
	fmt.Fprint(os.Stderr, "")
}
