package v1

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/hi-ai/gateway/internal/adapter"
	"github.com/hi-ai/gateway/internal/domain"
	"github.com/hi-ai/gateway/pkg/openai"
)

// ModelsHandler handles model listing requests.
type ModelsHandler struct {
	registry *adapter.Registry
}

// NewModelsHandler creates a new models handler.
func NewModelsHandler(registry *adapter.Registry) *ModelsHandler {
	return &ModelsHandler{registry: registry}
}

// ListModels handles GET /v1/models
func (h *ModelsHandler) ListModels(c *fiber.Ctx) error {
	models := make([]openai.Model, 0)

	// Collect models from all supported providers
	for _, info := range domain.SupportedProviders() {
		for _, modelID := range info.Models {
			models = append(models, openai.Model{
				ID:       modelID,
				Object:   "model",
				Created:  time.Now().Unix(),
				OwnedBy: info.ID,
			})
		}
	}

	return c.JSON(openai.ModelList{
		Object: "list",
		Data:   models,
	})
}
