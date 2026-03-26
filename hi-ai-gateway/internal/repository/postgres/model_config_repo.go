package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hi-ai/gateway/internal/domain"
)

// ModelConfigRepository handles model config persistence operations.
type ModelConfigRepository struct {
	db *DB
}

// NewModelConfigRepository creates a new ModelConfigRepository.
func NewModelConfigRepository(db *DB) *ModelConfigRepository {
	return &ModelConfigRepository{db: db}
}

// GetAll retrieves all model configs.
func (r *ModelConfigRepository) GetAll(ctx context.Context) ([]domain.ModelConfig, error) {
	query := `
		SELECT id, model_id, display_name, description, provider_name, priority, visible, tags, price_input, price_output, max_context, created_at, updated_at
		FROM model_configs
		ORDER BY priority DESC, model_id ASC
	`

	rows, err := r.db.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query model configs: %w", err)
	}
	defer rows.Close()

	var configs []domain.ModelConfig
	for rows.Next() {
		cfg, err := r.scanModelConfigFromRow(rows)
		if err != nil {
			return nil, err
		}
		configs = append(configs, *cfg)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate model configs: %w", err)
	}

	return configs, nil
}

// GetVisible retrieves all visible model configs ordered by priority DESC.
func (r *ModelConfigRepository) GetVisible(ctx context.Context) ([]domain.ModelConfig, error) {
	query := `
		SELECT id, model_id, display_name, description, provider_name, priority, visible, tags, price_input, price_output, max_context, created_at, updated_at
		FROM model_configs
		WHERE visible = TRUE
		ORDER BY priority DESC, model_id ASC
	`

	rows, err := r.db.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query visible model configs: %w", err)
	}
	defer rows.Close()

	var configs []domain.ModelConfig
	for rows.Next() {
		cfg, err := r.scanModelConfigFromRow(rows)
		if err != nil {
			return nil, err
		}
		configs = append(configs, *cfg)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate visible model configs: %w", err)
	}

	return configs, nil
}

// GetByID retrieves a model config by ID.
func (r *ModelConfigRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.ModelConfig, error) {
	query := `
		SELECT id, model_id, display_name, description, provider_name, priority, visible, tags, price_input, price_output, max_context, created_at, updated_at
		FROM model_configs
		WHERE id = $1
	`

	return r.scanModelConfig(ctx, query, id)
}

// GetByModelID retrieves a model config by model_id.
func (r *ModelConfigRepository) GetByModelID(ctx context.Context, modelID string) (*domain.ModelConfig, error) {
	query := `
		SELECT id, model_id, display_name, description, provider_name, priority, visible, tags, price_input, price_output, max_context, created_at, updated_at
		FROM model_configs
		WHERE model_id = $1
	`

	return r.scanModelConfig(ctx, query, modelID)
}

// Upsert creates or updates a model config by model_id.
func (r *ModelConfigRepository) Upsert(ctx context.Context, cfg *domain.ModelConfig) error {
	now := time.Now()
	if cfg.ID == uuid.Nil {
		cfg.ID = uuid.New()
	}
	if cfg.CreatedAt.IsZero() {
		cfg.CreatedAt = now
	}
	cfg.UpdatedAt = now

	query := `
		INSERT INTO model_configs (id, model_id, display_name, description, provider_name, priority, visible, tags, price_input, price_output, max_context, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (model_id) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			description = EXCLUDED.description,
			provider_name = EXCLUDED.provider_name,
			priority = EXCLUDED.priority,
			visible = EXCLUDED.visible,
			tags = EXCLUDED.tags,
			price_input = EXCLUDED.price_input,
			price_output = EXCLUDED.price_output,
			max_context = EXCLUDED.max_context,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.db.pool.Exec(ctx, query,
		cfg.ID,
		cfg.ModelID,
		cfg.DisplayName,
		cfg.Description,
		cfg.ProviderName,
		cfg.Priority,
		cfg.Visible,
		cfg.Tags,
		cfg.PriceInput,
		cfg.PriceOutput,
		cfg.MaxContext,
		cfg.CreatedAt,
		cfg.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("upsert model config: %w", err)
	}

	return nil
}

// UpdateVisibility updates the visibility of a model config.
func (r *ModelConfigRepository) UpdateVisibility(ctx context.Context, id uuid.UUID, visible bool) error {
	query := `
		UPDATE model_configs
		SET visible = $2, updated_at = $3
		WHERE id = $1
	`

	result, err := r.db.pool.Exec(ctx, query, id, visible, time.Now())
	if err != nil {
		return fmt.Errorf("update model visibility: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("model config not found")
	}

	return nil
}

// BatchUpdatePriority updates priorities for multiple models in a single transaction.
func (r *ModelConfigRepository) BatchUpdatePriority(ctx context.Context, items []domain.PriorityUpdate) error {
	if len(items) == 0 {
		return nil
	}

	tx, err := r.db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `UPDATE model_configs SET priority = $2, updated_at = $3 WHERE id = $1`
	now := time.Now()

	for _, item := range items {
		result, err := tx.Exec(ctx, query, item.ID, item.Priority, now)
		if err != nil {
			return fmt.Errorf("update priority for %s: %w", item.ID, err)
		}
		if result.RowsAffected() == 0 {
			return fmt.Errorf("model config %s not found", item.ID)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// Delete removes a model config from the database.
func (r *ModelConfigRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM model_configs WHERE id = $1`

	result, err := r.db.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete model config: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("model config not found")
	}

	return nil
}

// scanModelConfig scans a single model config row from the database.
func (r *ModelConfigRepository) scanModelConfig(ctx context.Context, query string, args ...interface{}) (*domain.ModelConfig, error) {
	row := r.db.pool.QueryRow(ctx, query, args...)

	var cfg domain.ModelConfig

	err := row.Scan(
		&cfg.ID,
		&cfg.ModelID,
		&cfg.DisplayName,
		&cfg.Description,
		&cfg.ProviderName,
		&cfg.Priority,
		&cfg.Visible,
		&cfg.Tags,
		&cfg.PriceInput,
		&cfg.PriceOutput,
		&cfg.MaxContext,
		&cfg.CreatedAt,
		&cfg.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("model config not found")
		}
		return nil, fmt.Errorf("scan model config: %w", err)
	}

	return &cfg, nil
}

// scanModelConfigFromRow scans a model config from an existing row iterator.
func (r *ModelConfigRepository) scanModelConfigFromRow(rows pgx.Rows) (*domain.ModelConfig, error) {
	var cfg domain.ModelConfig

	err := rows.Scan(
		&cfg.ID,
		&cfg.ModelID,
		&cfg.DisplayName,
		&cfg.Description,
		&cfg.ProviderName,
		&cfg.Priority,
		&cfg.Visible,
		&cfg.Tags,
		&cfg.PriceInput,
		&cfg.PriceOutput,
		&cfg.MaxContext,
		&cfg.CreatedAt,
		&cfg.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan model config row: %w", err)
	}

	return &cfg, nil
}
