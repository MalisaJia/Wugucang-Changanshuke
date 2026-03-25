package app

import (
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/valyala/fasthttp/fasthttpadaptor"

	"github.com/hi-ai/gateway/internal/middleware"
)

// NewServer creates and configures the Fiber HTTP server with all routes.
func NewServer(app *App) *fiber.App {
	server := fiber.New(fiber.Config{
		AppName:               "WuguHub Gateway",
		ReadTimeout:           durationSec(app.Config.Server.ReadTimeout),
		WriteTimeout:          durationSec(app.Config.Server.WriteTimeout),
		IdleTimeout:           durationSec(app.Config.Server.IdleTimeout),
		DisableStartupMessage: false,
		ErrorHandler:          defaultErrorHandler,
	})

	// Global middleware
	server.Use(recover.New())
	server.Use(middleware.RequestID())
	server.Use(middleware.CORS())
	server.Use(middleware.Metrics())

	// Health endpoints (no auth required)
	server.Get("/healthz", app.HealthHandler.Liveness)
	server.Get("/readyz", app.HealthHandler.Readiness)

	// Prometheus metrics endpoint
	if app.Config.Metrics.Enabled {
		server.Get(app.Config.Metrics.Path, func(c *fiber.Ctx) error {
			handler := fasthttpadaptor.NewFastHTTPHandler(promhttp.Handler())
			handler(c.Context())
			return nil
		})
	}

	// OpenAI-compatible proxy endpoints (API key auth)
	v1 := server.Group("/v1")
	v1.Use(middleware.APIKeyAuth(func(ctx context.Context, hash string) (*middleware.TenantContext, error) {
		// Look up API key by hash from database
		apiKey, err := app.APIKeyRepo.GetByHash(ctx, hash)
		if err != nil {
			return nil, fmt.Errorf("api key not found: %w", err)
		}

		// Check if key is active
		if !apiKey.IsActive() {
			return nil, fmt.Errorf("api key is not active")
		}

		// Get tenant to retrieve rate limits
		tenant, err := app.TenantRepo.GetByID(ctx, apiKey.TenantID)
		if err != nil {
			return nil, fmt.Errorf("tenant not found: %w", err)
		}

		// Check tenant status
		if tenant.Status != "active" {
			return nil, fmt.Errorf("tenant is not active")
		}

		// Determine rate limits (key-specific overrides tenant defaults)
		rateLimitRPM := tenant.RateLimitRPM
		rateLimitTPM := tenant.RateLimitTPM
		if apiKey.RateLimitRPM != nil {
			rateLimitRPM = *apiKey.RateLimitRPM
		}
		if apiKey.RateLimitTPM != nil {
			rateLimitTPM = *apiKey.RateLimitTPM
		}

		// Update last used timestamp asynchronously (best-effort)
		go func() {
			_ = app.APIKeyRepo.UpdateLastUsed(context.Background(), apiKey.ID)
		}()

		return &middleware.TenantContext{
			TenantID:     apiKey.TenantID,
			KeyID:        apiKey.ID,
			Role:         "member",
			RateLimitRPM: rateLimitRPM,
			RateLimitTPM: rateLimitTPM,
		}, nil
	}))

	// Add rate limiting middleware (runs after auth to access tenant context)
	if app.RedisClient != nil {
		rateLimiter := middleware.NewRateLimiter(
			app.RedisClient.Client(),
			app.Logger,
			middleware.RateLimitConfig{
				Enabled:    app.Config.RateLimit.Enabled,
				DefaultRPM: app.Config.RateLimit.DefaultRPM,
			},
		)
		v1.Use(rateLimiter.Middleware())
	}

	v1.Post("/chat/completions", app.ChatHandler.ChatCompletion)
	v1.Get("/models", app.ModelsHandler.ListModels)

	// Management API endpoints (JWT auth)
	api := server.Group("/api")

	// Auth endpoints (no auth required)
	authGroup := api.Group("/auth")
	authGroup.Post("/register", app.AuthHandler.Register)
	authGroup.Post("/login", app.AuthHandler.Login)
	authGroup.Post("/refresh", app.AuthHandler.Refresh)

	// Protected management endpoints
	protected := api.Group("")
	protected.Use(middleware.JWTAuth(app.Config.Auth.JWTSecret))

	// Add audit logging middleware (after JWT auth to access tenant context)
	protected.Use(app.AuditLogger.Middleware())

	// JWT authenticated chat endpoint (for frontend Chat page)
	// This allows logged-in users to chat without needing API keys
	protected.Post("/chat/completions", app.JWTChatHandler.HandleChat)

	// Audit logs endpoint
	protected.Get("/audit-logs", app.AuditHandler.List)

	// API key management
	protected.Get("/keys", app.KeysHandler.List)
	protected.Post("/keys", app.KeysHandler.Create)
	protected.Delete("/keys/:id", app.KeysHandler.Revoke)

	// Tenant management
	protected.Get("/tenant", app.TenantHandler.Get)
	protected.Put("/tenant", app.TenantHandler.Update)

	// User profile
	protected.Get("/profile", app.ProfileHandler.Get)
	protected.Put("/profile", app.ProfileHandler.Update)
	protected.Put("/profile/password", app.ProfileHandler.ChangePassword)

	// Provider configuration
	protected.Get("/providers", app.ProvidersHandler.List)
	protected.Put("/providers/:id", app.ProvidersHandler.Update)

	// Billing routes (JWT protected)
	billing := protected.Group("/billing")
	billing.Get("/balance", app.BillingHandler.GetBalance)
	billing.Get("/transactions", app.BillingHandler.ListTransactions)
	billing.Get("/packages", app.BillingHandler.ListPackages)
	billing.Post("/recharge", app.BillingHandler.CreateRecharge)
	billing.Get("/usage-summary", app.BillingHandler.GetUsageSummary)
	billing.Get("/usage-logs", app.BillingHandler.ListUsageLogs)

	// Admin management routes (JWT protected, admin/owner only)
	adminGroup := protected.Group("/admin")
	adminGroup.Get("/stats", app.ManagementHandler.GetStats)
	adminGroup.Get("/users", app.ManagementHandler.ListUsers)
	adminGroup.Get("/users/:id/balance", app.ManagementHandler.GetUserBalance)
	adminGroup.Put("/users/:id/balance", app.ManagementHandler.AdjustUserBalance)
	adminGroup.Get("/refund-requests", app.ManagementHandler.ListRefundRequests)
	adminGroup.Post("/refund", app.ManagementHandler.ProcessRefund)

	// Security configuration routes (admin only)
	adminGroup.Get("/security/guardrails", app.SecurityHandler.GetGuardrails)
	adminGroup.Put("/security/guardrails", app.SecurityHandler.UpdateGuardrails)

	// Routing configuration routes (admin only)
	adminGroup.Get("/routing/config", app.RoutingHandler.GetConfig)
	adminGroup.Put("/routing/config", app.RoutingHandler.UpdateConfig)
	adminGroup.Get("/routing/breakers", app.RoutingHandler.GetBreakers)
	adminGroup.Get("/routing/rules", app.RoutingHandler.GetRules)

	// Payment orders routes (admin only)
	adminGroup.Get("/payments", app.PaymentsHandler.ListPayments)

	// API keys audit routes (admin only)
	adminGroup.Get("/api-keys", app.APIKeysAdminHandler.ListKeys)

	// Webhook routes (no auth, signature verification)
	webhooks := server.Group("/api/webhooks")
	webhooks.Post("/stripe", app.WebhookHandler.StripeWebhook(app.PaymentProviders["stripe"]))
	webhooks.Post("/alipay", app.WebhookHandler.AlipayWebhook(app.PaymentProviders["alipay"]))
	webhooks.Post("/wechat", app.WebhookHandler.WechatWebhook(app.PaymentProviders["wechat"]))

	return server
}

func defaultErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"error": fiber.Map{
			"message": err.Error(),
			"type":    "internal_error",
			"code":    code,
		},
	})
}

func durationSec(seconds int) time.Duration {
	if seconds <= 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}
