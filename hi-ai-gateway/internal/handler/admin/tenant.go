package admin

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"

	"github.com/hi-ai/gateway/internal/domain"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// TenantHandler handles tenant management endpoints.
type TenantHandler struct {
	tenantRepo *postgres.TenantRepository
	logger     *slog.Logger
}

// NewTenantHandler creates a new tenant handler.
func NewTenantHandler(tenantRepo *postgres.TenantRepository, logger *slog.Logger) *TenantHandler {
	return &TenantHandler{
		tenantRepo: tenantRepo,
		logger:     logger,
	}
}

// TenantResponse represents tenant info returned to clients.
type TenantResponse struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Slug         string         `json:"slug"`
	Plan         string         `json:"plan"`
	Status       string         `json:"status"`
	Settings     domain.JSONMap `json:"settings"`
	RateLimitRPM int            `json:"rate_limit_rpm"`
	RateLimitTPM int            `json:"rate_limit_tpm"`
	MaxKeys      int            `json:"max_keys"`
	CreatedAt    string         `json:"created_at"`
	UpdatedAt    string         `json:"updated_at"`
}

// UpdateTenantRequest is the request body for updating tenant settings.
type UpdateTenantRequest struct {
	Name     *string         `json:"name,omitempty"`
	Settings *domain.JSONMap `json:"settings,omitempty"`
}

// Get handles GET /api/tenant - Get current tenant info.
func (h *TenantHandler) Get(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tenant, err := h.tenantRepo.GetByID(c.Context(), tc.TenantID)
	if err != nil {
		h.logger.Error("failed to get tenant", "error", err, "tenant_id", tc.TenantID)
		e := apierr.NotFound("tenant not found")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	return c.JSON(TenantResponse{
		ID:           tenant.ID,
		Name:         tenant.Name,
		Slug:         tenant.Slug,
		Plan:         tenant.Plan,
		Status:       tenant.Status,
		Settings:     tenant.Settings,
		RateLimitRPM: tenant.RateLimitRPM,
		RateLimitTPM: tenant.RateLimitTPM,
		MaxKeys:      tenant.MaxKeys,
		CreatedAt:    tenant.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:    tenant.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// Update handles PUT /api/tenant - Update tenant settings.
func (h *TenantHandler) Update(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Only owner or admin can update tenant
	if tc.Role != string(domain.RoleOwner) && tc.Role != string(domain.RoleAdmin) {
		e := apierr.Forbidden("only owner or admin can update tenant settings")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req UpdateTenantRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Get current tenant
	tenant, err := h.tenantRepo.GetByID(c.Context(), tc.TenantID)
	if err != nil {
		h.logger.Error("failed to get tenant", "error", err, "tenant_id", tc.TenantID)
		e := apierr.NotFound("tenant not found")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Apply updates
	if req.Name != nil && *req.Name != "" {
		tenant.Name = *req.Name
	}
	if req.Settings != nil {
		// Merge settings
		if tenant.Settings == nil {
			tenant.Settings = make(domain.JSONMap)
		}
		for k, v := range *req.Settings {
			tenant.Settings[k] = v
		}
	}

	// Save updates
	if err := h.tenantRepo.Update(c.Context(), tenant); err != nil {
		h.logger.Error("failed to update tenant", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("failed to update tenant")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("tenant updated", "tenant_id", tc.TenantID, "user_id", tc.UserID)

	return c.JSON(TenantResponse{
		ID:           tenant.ID,
		Name:         tenant.Name,
		Slug:         tenant.Slug,
		Plan:         tenant.Plan,
		Status:       tenant.Status,
		Settings:     tenant.Settings,
		RateLimitRPM: tenant.RateLimitRPM,
		RateLimitTPM: tenant.RateLimitTPM,
		MaxKeys:      tenant.MaxKeys,
		CreatedAt:    tenant.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:    tenant.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	})
}
