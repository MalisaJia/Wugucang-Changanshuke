package admin

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"

	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
)

// SecurityHandler handles security configuration endpoints.
type SecurityHandler struct {
	guardrail *middleware.Guardrail
	logger    *slog.Logger
}

// NewSecurityHandler creates a new SecurityHandler.
func NewSecurityHandler(guardrail *middleware.Guardrail, logger *slog.Logger) *SecurityHandler {
	return &SecurityHandler{
		guardrail: guardrail,
		logger:    logger,
	}
}

// requireAdmin checks if the user is a platform admin.
func (h *SecurityHandler) requireAdmin(c *fiber.Ctx) (*middleware.TenantContext, error) {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		return nil, apierr.Unauthorized("authentication required")
	}

	if !tc.IsPlatformAdmin {
		return nil, apierr.Forbidden("platform admin access required")
	}

	return tc, nil
}

// GetGuardrails handles GET /api/admin/security/guardrails - Get current guardrail configuration.
func (h *SecurityHandler) GetGuardrails(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	config := h.guardrail.GetConfig()
	return c.JSON(config)
}

// UpdateGuardrailsRequest represents the request body for updating guardrail configuration.
type UpdateGuardrailsRequest struct {
	Mode  string               `json:"mode"`
	Rules []middleware.PIIRule `json:"rules"`
}

// UpdateGuardrails handles PUT /api/admin/security/guardrails - Update guardrail configuration.
func (h *SecurityHandler) UpdateGuardrails(c *fiber.Ctx) error {
	tc, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req UpdateGuardrailsRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate mode
	mode := middleware.GuardrailMode(req.Mode)
	if mode != middleware.GuardrailBlock && mode != middleware.GuardrailMask && mode != middleware.GuardrailOff {
		e := apierr.BadRequest("invalid mode: must be 'block', 'mask', or 'off'")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Update configuration
	config := middleware.GuardrailAPIConfig{
		Mode:  mode,
		Rules: req.Rules,
	}
	h.guardrail.UpdateConfig(config)

	h.logger.Info("guardrail configuration updated by admin",
		"admin_id", tc.UserID,
		"admin_email", tc.Email,
		"mode", req.Mode,
	)

	return c.JSON(fiber.Map{"success": true, "message": "Guardrail configuration updated"})
}
