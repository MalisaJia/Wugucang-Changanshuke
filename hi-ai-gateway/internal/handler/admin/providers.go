package admin

import (
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/hi-ai/gateway/internal/domain"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// ProvidersHandler handles provider configuration endpoints.
type ProvidersHandler struct {
	providerConfigRepo *postgres.ProviderConfigRepository
	logger             *slog.Logger
}

// NewProvidersHandler creates a new providers handler.
func NewProvidersHandler(repo *postgres.ProviderConfigRepository, logger *slog.Logger) *ProvidersHandler {
	return &ProvidersHandler{
		providerConfigRepo: repo,
		logger:             logger,
	}
}

// ProviderConfigResponse represents a provider config returned to clients.
type ProviderConfigResponse struct {
	ID         string         `json:"id"`
	ProviderID string         `json:"provider_id"`
	BaseURL    string         `json:"base_url,omitempty"`
	Enabled    bool           `json:"enabled"`
	Priority   int            `json:"priority"`
	Weight     int            `json:"weight"`
	HasAPIKey  bool           `json:"has_api_key"`
	Settings   domain.JSONMap `json:"settings"`
	CreatedAt  string         `json:"created_at"`
	UpdatedAt  string         `json:"updated_at"`
}

// ProviderWithConfigResponse includes both static provider info and user's config.
type ProviderWithConfigResponse struct {
	// Static provider info
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Website     string   `json:"website"`
	Models      []string `json:"models"`
	APIStyle    string   `json:"api_style"`
	// User's config (if exists)
	Config *ProviderConfigResponse `json:"config,omitempty"`
}

// UpdateProviderRequest is the request body for updating a provider config.
type UpdateProviderRequest struct {
	Enabled  *bool           `json:"enabled,omitempty"`
	APIKey   *string         `json:"api_key,omitempty"`
	BaseURL  *string         `json:"base_url,omitempty"`
	Priority *int            `json:"priority,omitempty"`
	Weight   *int            `json:"weight,omitempty"`
	Settings *domain.JSONMap `json:"settings,omitempty"`
}

// List handles GET /api/providers - List configured providers for tenant.
func (h *ProvidersHandler) List(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tc.TenantID)
	if err != nil {
		h.logger.Error("invalid tenant ID", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("invalid tenant ID")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Get tenant's provider configs
	configs, err := h.providerConfigRepo.ListByTenantID(c.Context(), tenantUUID)
	if err != nil {
		h.logger.Error("failed to list provider configs", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("failed to list providers")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Create a map of configs by provider ID
	configMap := make(map[string]*domain.ProviderConfig)
	for _, cfg := range configs {
		configMap[cfg.ProviderID] = cfg
	}

	// Get all supported providers and merge with configs
	supportedProviders := domain.SupportedProviders()
	response := make([]ProviderWithConfigResponse, len(supportedProviders))

	for i, provider := range supportedProviders {
		resp := ProviderWithConfigResponse{
			ID:          provider.ID,
			Name:        provider.Name,
			Description: provider.Description,
			Website:     provider.Website,
			Models:      provider.Models,
			APIStyle:    provider.APIStyle,
		}

		// Add config if exists
		if cfg, exists := configMap[provider.ID]; exists {
			resp.Config = &ProviderConfigResponse{
				ID:         cfg.ID.String(),
				ProviderID: cfg.ProviderID,
				BaseURL:    cfg.BaseURL,
				Enabled:    cfg.Enabled,
				Priority:   cfg.Priority,
				Weight:     cfg.Weight,
				HasAPIKey:  cfg.HasAPIKey(),
				Settings:   cfg.Settings,
				CreatedAt:  cfg.CreatedAt.Format("2006-01-02T15:04:05Z"),
				UpdatedAt:  cfg.UpdatedAt.Format("2006-01-02T15:04:05Z"),
			}
		}

		response[i] = resp
	}

	return c.JSON(fiber.Map{
		"providers": response,
	})
}

// Update handles PUT /api/providers/:id - Update provider config (upserts).
func (h *ProvidersHandler) Update(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Only owner or admin can update provider configs
	if tc.Role != string(domain.RoleOwner) && tc.Role != string(domain.RoleAdmin) {
		e := apierr.Forbidden("only owner or admin can update provider configurations")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	providerID := c.Params("id")
	if providerID == "" {
		e := apierr.BadRequest("provider ID is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate provider ID
	validProvider := false
	for _, p := range domain.SupportedProviders() {
		if p.ID == providerID {
			validProvider = true
			break
		}
	}
	if !validProvider {
		e := apierr.BadRequest("invalid provider ID")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req UpdateProviderRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tc.TenantID)
	if err != nil {
		h.logger.Error("invalid tenant ID", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("invalid tenant ID")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Get existing config or create new one
	existingCfg, err := h.providerConfigRepo.GetByTenantAndProvider(c.Context(), tenantUUID, providerID)
	
	now := time.Now()
	var cfg *domain.ProviderConfig

	if err != nil {
		// Create new config
		cfg = &domain.ProviderConfig{
			ID:         uuid.New(),
			TenantID:   tenantUUID,
			ProviderID: providerID,
			Enabled:    true,
			Priority:   0,
			Weight:     1,
			Settings:   make(domain.JSONMap),
			CreatedAt:  now,
			UpdatedAt:  now,
		}
	} else {
		cfg = existingCfg
		cfg.UpdatedAt = now
	}

	// Apply updates
	if req.Enabled != nil {
		cfg.Enabled = *req.Enabled
	}
	if req.APIKey != nil {
		// In production, this should be encrypted before storage
		// For now, we store it as-is (TODO: implement encryption)
		cfg.APIKeyEncrypted = *req.APIKey
	}
	if req.BaseURL != nil {
		cfg.BaseURL = *req.BaseURL
	}
	if req.Priority != nil {
		cfg.Priority = *req.Priority
	}
	if req.Weight != nil {
		cfg.Weight = *req.Weight
	}
	if req.Settings != nil {
		if cfg.Settings == nil {
			cfg.Settings = make(domain.JSONMap)
		}
		for k, v := range *req.Settings {
			cfg.Settings[k] = v
		}
	}

	// Upsert the config
	if err := h.providerConfigRepo.Upsert(c.Context(), cfg); err != nil {
		h.logger.Error("failed to update provider config", "error", err, "provider_id", providerID, "tenant_id", tc.TenantID)
		e := apierr.InternalError("failed to update provider configuration")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("provider config updated", "provider_id", providerID, "tenant_id", tc.TenantID, "user_id", tc.UserID)

	return c.JSON(ProviderConfigResponse{
		ID:         cfg.ID.String(),
		ProviderID: cfg.ProviderID,
		BaseURL:    cfg.BaseURL,
		Enabled:    cfg.Enabled,
		Priority:   cfg.Priority,
		Weight:     cfg.Weight,
		HasAPIKey:  cfg.HasAPIKey(),
		Settings:   cfg.Settings,
		CreatedAt:  cfg.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:  cfg.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	})
}
