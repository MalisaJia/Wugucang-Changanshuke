package admin

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/hi-ai/gateway/internal/config"
	"github.com/hi-ai/gateway/internal/domain"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/service"
)

// ModelsAdminHandler handles platform-wide model configuration endpoints.
type ModelsAdminHandler struct {
	modelSvc *service.ModelService
	cfg      *config.Config
	logger   *slog.Logger
}

// NewModelsAdminHandler creates a new ModelsAdminHandler.
func NewModelsAdminHandler(modelSvc *service.ModelService, cfg *config.Config, logger *slog.Logger) *ModelsAdminHandler {
	return &ModelsAdminHandler{
		modelSvc: modelSvc,
		cfg:      cfg,
		logger:   logger,
	}
}

// requireAdmin checks if the user is a platform admin.
// Returns the TenantContext if admin, nil otherwise.
func (h *ModelsAdminHandler) requireAdmin(c *fiber.Ctx) *middleware.TenantContext {
	tc := middleware.GetTenantContext(c)
	if tc == nil || !tc.IsPlatformAdmin {
		return nil
	}
	return tc
}

// UpdateModelRequest is the request body for updating a model config.
type UpdateModelRequest struct {
	DisplayName *string  `json:"display_name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Priority    *int     `json:"priority,omitempty"`
	Visible     *bool    `json:"visible,omitempty"`
	Tags        *string  `json:"tags,omitempty"`
	PriceInput  *float64 `json:"price_input,omitempty"`
	PriceOutput *float64 `json:"price_output,omitempty"`
	MaxContext  *int     `json:"max_context,omitempty"`
}

// ToggleVisibilityRequest is the request body for toggling model visibility.
type ToggleVisibilityRequest struct {
	Visible bool `json:"visible"`
}

// ReorderRequest is the request body for batch reordering models.
type ReorderRequest struct {
	Items []domain.PriorityUpdate `json:"items"`
}

// List handles GET /api/admin/models - List all models (admin only).
func (h *ModelsAdminHandler) List(c *fiber.Ctx) error {
	tc := h.requireAdmin(c)
	if tc == nil {
		e := apierr.Forbidden("platform admin access required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	models, err := h.modelSvc.GetAllModels(c.Context())
	if err != nil {
		h.logger.Error("failed to list models", "error", err)
		e := apierr.InternalError("failed to list models")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	return c.JSON(fiber.Map{
		"models": models,
	})
}

// Update handles PUT /api/admin/models/:id - Update a model config (admin only).
func (h *ModelsAdminHandler) Update(c *fiber.Ctx) error {
	tc := h.requireAdmin(c)
	if tc == nil {
		e := apierr.Forbidden("platform admin access required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse model ID from params
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		e := apierr.BadRequest("invalid model ID format")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse request body
	var req UpdateModelRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Get existing model
	existing, err := h.modelSvc.GetModel(c.Context(), id)
	if err != nil {
		h.logger.Error("failed to get model", "id", id, "error", err)
		e := apierr.NotFound("model not found")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Apply updates
	if req.DisplayName != nil {
		existing.DisplayName = *req.DisplayName
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Priority != nil {
		existing.Priority = *req.Priority
	}
	if req.Visible != nil {
		existing.Visible = *req.Visible
	}
	if req.Tags != nil {
		existing.Tags = *req.Tags
	}
	if req.PriceInput != nil {
		existing.PriceInput = *req.PriceInput
	}
	if req.PriceOutput != nil {
		existing.PriceOutput = *req.PriceOutput
	}
	if req.MaxContext != nil {
		existing.MaxContext = *req.MaxContext
	}

	// Save updated model
	if err := h.modelSvc.UpdateModel(c.Context(), existing); err != nil {
		h.logger.Error("failed to update model", "id", id, "error", err)
		e := apierr.InternalError("failed to update model")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("model updated", "model_id", existing.ModelID, "admin_user_id", tc.UserID)

	return c.JSON(existing)
}

// Toggle handles POST /api/admin/models/:id/toggle - Toggle model visibility (admin only).
func (h *ModelsAdminHandler) Toggle(c *fiber.Ctx) error {
	tc := h.requireAdmin(c)
	if tc == nil {
		e := apierr.Forbidden("platform admin access required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse model ID from params
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		e := apierr.BadRequest("invalid model ID format")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse request body
	var req ToggleVisibilityRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Toggle visibility
	if err := h.modelSvc.ToggleVisibility(c.Context(), id, req.Visible); err != nil {
		h.logger.Error("failed to toggle model visibility", "id", id, "error", err)
		e := apierr.InternalError("failed to toggle model visibility")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("model visibility toggled", "id", id, "visible", req.Visible, "admin_user_id", tc.UserID)

	return c.JSON(fiber.Map{
		"success": true,
		"visible": req.Visible,
	})
}

// Reorder handles POST /api/admin/models/reorder - Batch reorder models (admin only).
func (h *ModelsAdminHandler) Reorder(c *fiber.Ctx) error {
	tc := h.requireAdmin(c)
	if tc == nil {
		e := apierr.Forbidden("platform admin access required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse request body
	var req ReorderRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if len(req.Items) == 0 {
		e := apierr.BadRequest("items array is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Batch update priorities
	if err := h.modelSvc.BatchReorder(c.Context(), req.Items); err != nil {
		h.logger.Error("failed to reorder models", "error", err)
		e := apierr.InternalError("failed to reorder models")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("models reordered", "count", len(req.Items), "admin_user_id", tc.UserID)

	return c.JSON(fiber.Map{
		"success": true,
		"updated": len(req.Items),
	})
}

// Sync handles POST /api/admin/models/sync - Force sync models from config (admin only).
func (h *ModelsAdminHandler) Sync(c *fiber.Ctx) error {
	tc := h.requireAdmin(c)
	if tc == nil {
		e := apierr.Forbidden("platform admin access required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Sync models from config
	if err := h.modelSvc.SyncModelsFromConfig(c.Context(), h.cfg.Providers); err != nil {
		h.logger.Error("failed to sync models from config", "error", err)
		e := apierr.InternalError("failed to sync models from config")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("models synced from config", "admin_user_id", tc.UserID)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "models synced from config",
	})
}
