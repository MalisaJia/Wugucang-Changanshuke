package admin

import (
	"log/slog"
	"strconv"

	"github.com/gofiber/fiber/v2"

	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// APIKeysAdminHandler handles API key administration endpoints.
type APIKeysAdminHandler struct {
	apiKeyRepo *postgres.APIKeyRepository
	logger     *slog.Logger
}

// NewAPIKeysAdminHandler creates a new APIKeysAdminHandler.
func NewAPIKeysAdminHandler(apiKeyRepo *postgres.APIKeyRepository, logger *slog.Logger) *APIKeysAdminHandler {
	return &APIKeysAdminHandler{
		apiKeyRepo: apiKeyRepo,
		logger:     logger,
	}
}

// requireAdmin checks if the user is a platform admin.
func (h *APIKeysAdminHandler) requireAdmin(c *fiber.Ctx) (*middleware.TenantContext, error) {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		return nil, apierr.Unauthorized("authentication required")
	}

	if !tc.IsPlatformAdmin {
		return nil, apierr.Forbidden("platform admin access required")
	}

	return tc, nil
}

// APIKeysListResponse represents the paginated API keys response.
type APIKeysListResponse struct {
	Keys    []postgres.AdminAPIKey `json:"keys"`
	Total   int                    `json:"total"`
	Page    int                    `json:"page"`
	PerPage int                    `json:"per_page"`
}

// ListKeys handles GET /api/admin/api-keys - List all API keys across tenants.
func (h *APIKeysAdminHandler) ListKeys(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse query params
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	tenantFilter := c.Query("tenant_id", "")

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	keys, total, err := h.apiKeyRepo.ListAllKeys(c.Context(), page, perPage, tenantFilter)
	if err != nil {
		h.logger.Error("failed to list API keys", "error", err)
		e := apierr.InternalError("failed to list API keys")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if keys == nil {
		keys = []postgres.AdminAPIKey{}
	}

	return c.JSON(APIKeysListResponse{
		Keys:    keys,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}
