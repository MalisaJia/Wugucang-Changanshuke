package admin

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"

	"github.com/hi-ai/gateway/internal/config"
	"github.com/hi-ai/gateway/internal/domain"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
)

// RoutingHandler handles routing configuration endpoints.
type RoutingHandler struct {
	config      *config.Config
	breakerPool *middleware.BreakerPool
	logger      *slog.Logger
}

// NewRoutingHandler creates a new RoutingHandler.
func NewRoutingHandler(cfg *config.Config, breakerPool *middleware.BreakerPool, logger *slog.Logger) *RoutingHandler {
	return &RoutingHandler{
		config:      cfg,
		breakerPool: breakerPool,
		logger:      logger,
	}
}

// requireAdmin checks if the user has admin or owner role.
func (h *RoutingHandler) requireAdmin(c *fiber.Ctx) (*middleware.TenantContext, error) {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		return nil, apierr.Unauthorized("authentication required")
	}

	role := domain.Role(tc.Role)
	if !role.HasPermission(domain.RoleAdmin) {
		return nil, apierr.Forbidden("admin access required")
	}

	return tc, nil
}

// RoutingConfigResponse represents the routing configuration response.
type RoutingConfigResponse struct {
	Routing        RoutingSettings        `json:"routing"`
	Retry          RetrySettings          `json:"retry"`
	CircuitBreaker CircuitBreakerSettings `json:"circuit_breaker"`
}

// RoutingSettings represents routing configuration.
type RoutingSettings struct {
	Mode        string              `json:"mode"`
	HealthCheck HealthCheckSettings `json:"health_check"`
}

// HealthCheckSettings represents health check configuration.
type HealthCheckSettings struct {
	Window         string `json:"window"`
	ErrorThreshold int    `json:"error_threshold"`
}

// RetrySettings represents retry configuration.
type RetrySettings struct {
	MaxAttempts       int     `json:"max_attempts"`
	InitialBackoff    string  `json:"initial_backoff"`
	MaxBackoff        string  `json:"max_backoff"`
	BackoffMultiplier float64 `json:"backoff_multiplier"`
}

// CircuitBreakerSettings represents circuit breaker configuration.
type CircuitBreakerSettings struct {
	FailureThreshold int    `json:"failure_threshold"`
	SuccessThreshold int    `json:"success_threshold"`
	Timeout          string `json:"timeout"`
	Window           string `json:"window"`
}

// GetConfig handles GET /api/admin/routing/config - Get current routing configuration.
func (h *RoutingHandler) GetConfig(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	response := RoutingConfigResponse{
		Routing: RoutingSettings{
			Mode: h.config.Routing.Mode,
			HealthCheck: HealthCheckSettings{
				Window:         h.config.Routing.HealthCheck.Window,
				ErrorThreshold: h.config.Routing.HealthCheck.ErrorThreshold,
			},
		},
		Retry: RetrySettings{
			MaxAttempts:       h.config.Retry.MaxAttempts,
			InitialBackoff:    h.config.Retry.InitialBackoff.String(),
			MaxBackoff:        h.config.Retry.MaxBackoff.String(),
			BackoffMultiplier: h.config.Retry.BackoffMultiplier,
		},
		CircuitBreaker: CircuitBreakerSettings{
			FailureThreshold: h.config.CircuitBreaker.FailureThreshold,
			SuccessThreshold: h.config.CircuitBreaker.SuccessThreshold,
			Timeout:          h.config.CircuitBreaker.Timeout.String(),
			Window:           h.config.CircuitBreaker.Window.String(),
		},
	}

	return c.JSON(response)
}

// UpdateRoutingConfigRequest represents the request for updating routing config.
type UpdateRoutingConfigRequest struct {
	Routing *RoutingSettings `json:"routing,omitempty"`
}

// UpdateConfig handles PUT /api/admin/routing/config - Update routing configuration.
// Note: Since config is loaded at startup, this only logs the request for now.
// A full implementation would require config persistence and hot-reload support.
func (h *RoutingHandler) UpdateConfig(c *fiber.Ctx) error {
	tc, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req UpdateRoutingConfigRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate routing mode if provided
	if req.Routing != nil {
		validModes := map[string]bool{
			"single":      true,
			"fallback":    true,
			"loadbalance": true,
			"conditional": true,
		}
		if !validModes[req.Routing.Mode] {
			e := apierr.BadRequest("invalid routing mode")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}
	}

	h.logger.Info("routing configuration update requested",
		"admin_id", tc.UserID,
		"admin_email", tc.Email,
		"requested_config", req,
	)

	// Note: Runtime config changes are not persisted.
	// This endpoint is for future implementation with config persistence.
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Configuration read-only. Changes require server restart with updated config.yaml.",
	})
}

// BreakersResponse represents the circuit breakers status response.
type BreakersResponse struct {
	Breakers []middleware.BreakerStatus `json:"breakers"`
}

// GetBreakers handles GET /api/admin/routing/breakers - Get circuit breaker status.
func (h *RoutingHandler) GetBreakers(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	breakers := h.breakerPool.ListAll()
	if breakers == nil {
		breakers = []middleware.BreakerStatus{}
	}

	return c.JSON(BreakersResponse{
		Breakers: breakers,
	})
}

// ConditionalRuleResponse represents a conditional routing rule.
type ConditionalRuleResponse struct {
	Priority   int                    `json:"priority"`
	Conditions map[string]interface{} `json:"conditions"`
	Targets    []TargetResponse       `json:"targets"`
}

// TargetResponse represents a routing target.
type TargetResponse struct {
	ProviderID string `json:"provider_id"`
	ModelID    string `json:"model_id"`
	Weight     int    `json:"weight,omitempty"`
	Priority   int    `json:"priority,omitempty"`
}

// RulesResponse represents the conditional routing rules response.
type RulesResponse struct {
	Mode  string                    `json:"mode"`
	Rules []ConditionalRuleResponse `json:"rules"`
}

// GetRules handles GET /api/admin/routing/rules - Get conditional routing rules.
func (h *RoutingHandler) GetRules(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Routing rules are typically stored in config or database
	// For now, return the current routing mode and an empty rules array
	// since conditional rules would be defined in config.yaml or a database
	response := RulesResponse{
		Mode:  h.config.Routing.Mode,
		Rules: []ConditionalRuleResponse{},
	}

	// If using conditional routing mode, rules would be loaded from config
	// This is a placeholder for future database-backed rule management
	if h.config.Routing.Mode == "conditional" {
		h.logger.Info("conditional routing rules requested",
			"note", "Rules are configured in config.yaml or database",
		)
	}

	return c.JSON(response)
}
