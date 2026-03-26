package v1

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/hi-ai/gateway/internal/adapter"
	"github.com/hi-ai/gateway/internal/domain"
	"github.com/hi-ai/gateway/internal/repository/postgres"
	"github.com/hi-ai/gateway/pkg/openai"
)

// ModelsHandler handles model listing requests.
type ModelsHandler struct {
	registry        *adapter.Registry
	modelConfigRepo *postgres.ModelConfigRepository
}

// NewModelsHandler creates a new models handler.
func NewModelsHandler(registry *adapter.Registry, modelConfigRepo *postgres.ModelConfigRepository) *ModelsHandler {
	return &ModelsHandler{
		registry:        registry,
		modelConfigRepo: modelConfigRepo,
	}
}

// ListModels handles GET /v1/models
func (h *ModelsHandler) ListModels(c *fiber.Ctx) error {
	// Try to get models from database first
	if h.modelConfigRepo != nil {
		configs, err := h.modelConfigRepo.GetVisible(c.Context())
		if err == nil && len(configs) > 0 {
			models := make([]openai.Model, 0, len(configs))
			for _, cfg := range configs {
				models = append(models, openai.Model{
					ID:      cfg.ModelID,
					Object:  "model",
					Created: cfg.CreatedAt.Unix(),
					OwnedBy: cfg.ProviderName,
				})
			}
			return c.JSON(openai.ModelList{
				Object: "list",
				Data:   models,
			})
		}
	}

	// Fallback to static list if DB is empty or errors
	models := make([]openai.Model, 0)

	// Collect models from all supported providers
	for _, info := range domain.SupportedProviders() {
		for _, modelID := range info.Models {
			models = append(models, openai.Model{
				ID:      modelID,
				Object:  "model",
				Created: time.Now().Unix(),
				OwnedBy: info.ID,
			})
		}
	}

	return c.JSON(openai.ModelList{
		Object: "list",
		Data:   models,
	})
}
