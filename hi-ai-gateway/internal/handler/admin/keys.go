package admin

import (
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/repository/postgres"
	"github.com/hi-ai/gateway/internal/service"
)

// KeysHandler handles API key management endpoints.
type KeysHandler struct {
	apikeySvc  *service.APIKeyService
	apikeyRepo *postgres.APIKeyRepository
	logger     *slog.Logger
}

// NewKeysHandler creates a new keys handler.
func NewKeysHandler(apikeySvc *service.APIKeyService, apikeyRepo *postgres.APIKeyRepository, logger *slog.Logger) *KeysHandler {
	return &KeysHandler{
		apikeySvc:  apikeySvc,
		apikeyRepo: apikeyRepo,
		logger:     logger,
	}
}

// KeyResponse represents an API key in list responses (without the full key or hash).
type KeyResponse struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	KeyPrefix  string     `json:"key_prefix"`
	Status     string     `json:"status"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
}

// CreateKeyRequest is the request body for creating a new API key.
type CreateKeyRequest struct {
	Name          string   `json:"name"`
	Permissions   []string `json:"permissions,omitempty"`
	AllowedModels []string `json:"allowed_models,omitempty"`
	ExpiresInDays *int     `json:"expires_in_days,omitempty"`
}

// CreateKeyResponse is the response when creating a new API key.
type CreateKeyResponse struct {
	ID        string    `json:"id"`
	Key       string    `json:"key"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	Message   string    `json:"message"`
}

// List handles GET /api/keys - List all API keys for current tenant.
func (h *KeysHandler) List(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	keys, err := h.apikeyRepo.ListByTenantID(c.Context(), tc.TenantID)
	if err != nil {
		h.logger.Error("failed to list API keys", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("failed to list API keys")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Map to response format (never include full key or hash)
	response := make([]KeyResponse, len(keys))
	for i, k := range keys {
		response[i] = KeyResponse{
			ID:         k.ID,
			Name:       k.Name,
			KeyPrefix:  k.KeyPrefix,
			Status:     k.Status,
			CreatedAt:  k.CreatedAt,
			LastUsedAt: k.LastUsedAt,
			ExpiresAt:  k.ExpiresAt,
		}
	}

	return c.JSON(fiber.Map{
		"keys": response,
	})
}

// Create handles POST /api/keys - Create a new API key.
func (h *KeysHandler) Create(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req CreateKeyRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Default name if not provided
	if req.Name == "" {
		req.Name = "API Key"
	}

	// Generate the key using the service
	fullKey, key, err := h.apikeySvc.GenerateKey(tc.TenantID, tc.UserID, req.Name)
	if err != nil {
		h.logger.Error("failed to generate API key", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("failed to generate API key")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Set additional fields
	key.ID = uuid.New().String()
	key.AllowedModels = req.AllowedModels

	// Set expiration if provided
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		expiresAt := time.Now().AddDate(0, 0, *req.ExpiresInDays)
		key.ExpiresAt = &expiresAt
	}

	// Save to database
	if err := h.apikeyRepo.Create(c.Context(), key); err != nil {
		h.logger.Error("failed to save API key", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("failed to create API key")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("API key created", "key_id", key.ID, "tenant_id", tc.TenantID, "user_id", tc.UserID)

	return c.Status(fiber.StatusCreated).JSON(CreateKeyResponse{
		ID:        key.ID,
		Key:       fullKey,
		Name:      key.Name,
		CreatedAt: key.CreatedAt,
		Message:   "Save this key — you won't see it again",
	})
}

// Revoke handles DELETE /api/keys/:id - Revoke an API key.
func (h *KeysHandler) Revoke(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	keyID := c.Params("id")
	if keyID == "" {
		e := apierr.BadRequest("key ID is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Verify the key belongs to this tenant
	key, err := h.apikeyRepo.GetByID(c.Context(), keyID)
	if err != nil {
		h.logger.Error("failed to get API key", "error", err, "key_id", keyID)
		e := apierr.NotFound("API key not found")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if key.TenantID != tc.TenantID {
		e := apierr.Forbidden("you don't have permission to revoke this key")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Revoke the key
	if err := h.apikeyRepo.Revoke(c.Context(), keyID); err != nil {
		h.logger.Error("failed to revoke API key", "error", err, "key_id", keyID)
		e := apierr.InternalError("failed to revoke API key")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("API key revoked", "key_id", keyID, "tenant_id", tc.TenantID, "user_id", tc.UserID)

	return c.JSON(fiber.Map{
		"message": "API key revoked",
	})
}
