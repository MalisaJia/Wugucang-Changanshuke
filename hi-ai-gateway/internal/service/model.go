package service

import (
	"context"
	"log/slog"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/hi-ai/gateway/internal/config"
	"github.com/hi-ai/gateway/internal/domain"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// ModelService provides business logic for model configuration management.
type ModelService struct {
	repo   *postgres.ModelConfigRepository
	logger *slog.Logger
}

// NewModelService creates a new ModelService.
func NewModelService(repo *postgres.ModelConfigRepository, logger *slog.Logger) *ModelService {
	return &ModelService{repo: repo, logger: logger}
}

// SyncModelsFromConfig syncs models from config.yaml providers to the database.
// For NEW models: creates with visible=true, priority=0, and inferred display_name/provider_name.
// For EXISTING models: does NOT overwrite admin-modified fields.
func (s *ModelService) SyncModelsFromConfig(ctx context.Context, providers []config.ProviderConfig) error {
	// Get all existing models from DB to build a map
	existing, err := s.repo.GetAll(ctx)
	if err != nil {
		return err
	}

	existingMap := make(map[string]bool)
	for _, cfg := range existing {
		existingMap[cfg.ModelID] = true
	}

	// Collect unique model IDs from config
	seenModels := make(map[string]bool)
	var newModels []domain.ModelConfig

	for _, provider := range providers {
		if !provider.Enabled {
			continue
		}
		for _, modelID := range provider.Models {
			// Skip if already processed or already exists in DB
			if seenModels[modelID] || existingMap[modelID] {
				seenModels[modelID] = true
				continue
			}
			seenModels[modelID] = true

			// Create new model config
			newModels = append(newModels, domain.ModelConfig{
				ID:           uuid.New(),
				ModelID:      modelID,
				DisplayName:  formatDisplayName(modelID),
				ProviderName: inferProviderFromModelID(modelID),
				Priority:     0,
				Visible:      true,
				Description:  "",
				Tags:         "",
				PriceInput:   0,
				PriceOutput:  0,
				MaxContext:   0,
			})
		}
	}

	// Insert new models only
	for i := range newModels {
		if err := s.repo.Upsert(ctx, &newModels[i]); err != nil {
			s.logger.Error("failed to upsert model", "model_id", newModels[i].ModelID, "error", err)
			// Continue with other models
		}
	}

	s.logger.Info("synced models from config", "new_models", len(newModels), "existing_models", len(existing))
	return nil
}

// GetAllModels retrieves all model configs (for admin).
func (s *ModelService) GetAllModels(ctx context.Context) ([]domain.ModelConfig, error) {
	return s.repo.GetAll(ctx)
}

// GetVisibleModels retrieves only visible model configs (for public API).
func (s *ModelService) GetVisibleModels(ctx context.Context) ([]domain.ModelConfig, error) {
	return s.repo.GetVisible(ctx)
}

// GetModel retrieves a model config by ID.
func (s *ModelService) GetModel(ctx context.Context, id uuid.UUID) (*domain.ModelConfig, error) {
	return s.repo.GetByID(ctx, id)
}

// UpdateModel updates a model config.
func (s *ModelService) UpdateModel(ctx context.Context, cfg *domain.ModelConfig) error {
	return s.repo.Upsert(ctx, cfg)
}

// ToggleVisibility toggles the visibility of a model.
func (s *ModelService) ToggleVisibility(ctx context.Context, id uuid.UUID, visible bool) error {
	return s.repo.UpdateVisibility(ctx, id, visible)
}

// BatchReorder updates priorities for multiple models.
func (s *ModelService) BatchReorder(ctx context.Context, items []domain.PriorityUpdate) error {
	return s.repo.BatchUpdatePriority(ctx, items)
}

// inferProviderFromModelID infers the provider name from the model ID.
func inferProviderFromModelID(modelID string) string {
	lower := strings.ToLower(modelID)
	switch {
	case strings.HasPrefix(lower, "gpt"):
		return "OpenAI"
	case strings.HasPrefix(lower, "o1"), strings.HasPrefix(lower, "o3"), strings.HasPrefix(lower, "o4"):
		return "OpenAI"
	case strings.HasPrefix(lower, "claude"):
		return "Anthropic"
	case strings.HasPrefix(lower, "gemini"):
		return "Google"
	case strings.HasPrefix(lower, "deepseek"):
		return "DeepSeek"
	case strings.HasPrefix(lower, "llama"):
		return "Meta"
	case strings.HasPrefix(lower, "mistral"), strings.HasPrefix(lower, "mixtral"):
		return "Mistral"
	case strings.HasPrefix(lower, "qwen"):
		return "Alibaba"
	case strings.HasPrefix(lower, "yi"):
		return "01.AI"
	default:
		return "Unknown"
	}
}

// formatDisplayName converts a model ID to a human-friendly display name.
// Examples:
//   - "gpt-4o-mini" → "GPT-4o Mini"
//   - "claude-sonnet-4-6-thinking" → "Claude Sonnet 4.6 Thinking"
//   - "gemini-2.5-flash-thinking" → "Gemini 2.5 Flash Thinking"
func formatDisplayName(modelID string) string {
	parts := strings.Split(modelID, "-")
	if len(parts) == 0 {
		return modelID
	}

	var result []string
	for _, part := range parts {
		if part == "" {
			continue
		}
		// Special case handling for common prefixes
		formatted := formatPart(part)
		result = append(result, formatted)
	}

	return strings.Join(result, " ")
}

// formatPart formats a single part of the model ID.
func formatPart(part string) string {
	lower := strings.ToLower(part)

	// Special abbreviations that should be uppercase
	switch lower {
	case "gpt", "api", "ai", "llm":
		return strings.ToUpper(part)
	}

	// Title case the part
	if len(part) == 0 {
		return part
	}

	runes := []rune(part)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}
