package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hi-ai/gateway/internal/domain"
)

// ProviderConfigRepository handles provider config persistence operations.
type ProviderConfigRepository struct {
	db *DB
}

// NewProviderConfigRepository creates a new ProviderConfigRepository.
func NewProviderConfigRepository(db *DB) *ProviderConfigRepository {
	return &ProviderConfigRepository{db: db}
}

// Create inserts a new provider config into the database.
func (r *ProviderConfigRepository) Create(ctx context.Context, cfg *domain.ProviderConfig) error {
	settingsJSON, err := json.Marshal(cfg.Settings)
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}

	query := `
		INSERT INTO provider_configs (id, tenant_id, provider_id, api_key_encrypted, base_url, enabled, priority, weight, settings, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err = r.db.pool.Exec(ctx, query,
		cfg.ID,
		cfg.TenantID,
		cfg.ProviderID,
		cfg.APIKeyEncrypted,
		cfg.BaseURL,
		cfg.Enabled,
		cfg.Priority,
		cfg.Weight,
		settingsJSON,
		cfg.CreatedAt,
		cfg.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert provider config: %w", err)
	}

	return nil
}

// GetByTenantAndProvider retrieves a provider config by tenant and provider ID.
func (r *ProviderConfigRepository) GetByTenantAndProvider(ctx context.Context, tenantID uuid.UUID, providerID string) (*domain.ProviderConfig, error) {
	query := `
		SELECT id, tenant_id, provider_id, api_key_encrypted, base_url, enabled, priority, weight, settings, created_at, updated_at
		FROM provider_configs
		WHERE tenant_id = $1 AND provider_id = $2
	`

	return r.scanProviderConfig(ctx, query, tenantID, providerID)
}

// GetByID retrieves a provider config by ID.
func (r *ProviderConfigRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.ProviderConfig, error) {
	query := `
		SELECT id, tenant_id, provider_id, api_key_encrypted, base_url, enabled, priority, weight, settings, created_at, updated_at
		FROM provider_configs
		WHERE id = $1
	`

	return r.scanProviderConfig(ctx, query, id)
}

// ListByTenantID retrieves all provider configs for a tenant.
func (r *ProviderConfigRepository) ListByTenantID(ctx context.Context, tenantID uuid.UUID) ([]*domain.ProviderConfig, error) {
	query := `
		SELECT id, tenant_id, provider_id, api_key_encrypted, base_url, enabled, priority, weight, settings, created_at, updated_at
		FROM provider_configs
		WHERE tenant_id = $1
		ORDER BY priority DESC, provider_id ASC
	`

	rows, err := r.db.pool.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query provider configs: %w", err)
	}
	defer rows.Close()

	var configs []*domain.ProviderConfig
	for rows.Next() {
		cfg, err := r.scanProviderConfigFromRow(rows)
		if err != nil {
			return nil, err
		}
		configs = append(configs, cfg)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate provider configs: %w", err)
	}

	return configs, nil
}

// Update updates an existing provider config.
func (r *ProviderConfigRepository) Update(ctx context.Context, cfg *domain.ProviderConfig) error {
	settingsJSON, err := json.Marshal(cfg.Settings)
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}

	query := `
		UPDATE provider_configs
		SET api_key_encrypted = $2, base_url = $3, enabled = $4, priority = $5, weight = $6, settings = $7, updated_at = $8
		WHERE id = $1
	`

	result, err := r.db.pool.Exec(ctx, query,
		cfg.ID,
		cfg.APIKeyEncrypted,
		cfg.BaseURL,
		cfg.Enabled,
		cfg.Priority,
		cfg.Weight,
		settingsJSON,
		time.Now(),
	)
	if err != nil {
		return fmt.Errorf("update provider config: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("provider config not found")
	}

	return nil
}

// Upsert creates or updates a provider config.
func (r *ProviderConfigRepository) Upsert(ctx context.Context, cfg *domain.ProviderConfig) error {
	settingsJSON, err := json.Marshal(cfg.Settings)
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}

	query := `
		INSERT INTO provider_configs (id, tenant_id, provider_id, api_key_encrypted, base_url, enabled, priority, weight, settings, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (tenant_id, provider_id) DO UPDATE SET
			api_key_encrypted = EXCLUDED.api_key_encrypted,
			base_url = EXCLUDED.base_url,
			enabled = EXCLUDED.enabled,
			priority = EXCLUDED.priority,
			weight = EXCLUDED.weight,
			settings = EXCLUDED.settings,
			updated_at = EXCLUDED.updated_at
	`

	_, err = r.db.pool.Exec(ctx, query,
		cfg.ID,
		cfg.TenantID,
		cfg.ProviderID,
		cfg.APIKeyEncrypted,
		cfg.BaseURL,
		cfg.Enabled,
		cfg.Priority,
		cfg.Weight,
		settingsJSON,
		cfg.CreatedAt,
		cfg.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("upsert provider config: %w", err)
	}

	return nil
}

// Delete removes a provider config from the database.
func (r *ProviderConfigRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM provider_configs WHERE id = $1`

	result, err := r.db.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete provider config: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("provider config not found")
	}

	return nil
}

// scanProviderConfig scans a single provider config row from the database.
func (r *ProviderConfigRepository) scanProviderConfig(ctx context.Context, query string, args ...interface{}) (*domain.ProviderConfig, error) {
	row := r.db.pool.QueryRow(ctx, query, args...)

	var cfg domain.ProviderConfig
	var settingsJSON []byte

	err := row.Scan(
		&cfg.ID,
		&cfg.TenantID,
		&cfg.ProviderID,
		&cfg.APIKeyEncrypted,
		&cfg.BaseURL,
		&cfg.Enabled,
		&cfg.Priority,
		&cfg.Weight,
		&settingsJSON,
		&cfg.CreatedAt,
		&cfg.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("provider config not found")
		}
		return nil, fmt.Errorf("scan provider config: %w", err)
	}

	if len(settingsJSON) > 0 {
		if err := json.Unmarshal(settingsJSON, &cfg.Settings); err != nil {
			return nil, fmt.Errorf("unmarshal settings: %w", err)
		}
	}
	if cfg.Settings == nil {
		cfg.Settings = make(domain.JSONMap)
	}

	return &cfg, nil
}

// scanProviderConfigFromRow scans a provider config from an existing row iterator.
func (r *ProviderConfigRepository) scanProviderConfigFromRow(rows pgx.Rows) (*domain.ProviderConfig, error) {
	var cfg domain.ProviderConfig
	var settingsJSON []byte

	err := rows.Scan(
		&cfg.ID,
		&cfg.TenantID,
		&cfg.ProviderID,
		&cfg.APIKeyEncrypted,
		&cfg.BaseURL,
		&cfg.Enabled,
		&cfg.Priority,
		&cfg.Weight,
		&settingsJSON,
		&cfg.CreatedAt,
		&cfg.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan provider config row: %w", err)
	}

	if len(settingsJSON) > 0 {
		if err := json.Unmarshal(settingsJSON, &cfg.Settings); err != nil {
			return nil, fmt.Errorf("unmarshal settings: %w", err)
		}
	}
	if cfg.Settings == nil {
		cfg.Settings = make(domain.JSONMap)
	}

	return &cfg, nil
}
