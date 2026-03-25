package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/hi-ai/gateway/internal/domain"
)

// APIKeyRepository handles API key persistence operations.
type APIKeyRepository struct {
	db *DB
}

// NewAPIKeyRepository creates a new APIKeyRepository.
func NewAPIKeyRepository(db *DB) *APIKeyRepository {
	return &APIKeyRepository{db: db}
}

// Create inserts a new API key into the database.
func (r *APIKeyRepository) Create(ctx context.Context, k *domain.APIKey) error {
	permissionsJSON, err := json.Marshal(k.Permissions)
	if err != nil {
		return fmt.Errorf("marshal permissions: %w", err)
	}

	query := `
		INSERT INTO api_keys (id, tenant_id, created_by, name, key_prefix, key_hash, status, permissions, 
		                      rate_limit_rpm, rate_limit_tpm, allowed_models, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err = r.db.pool.Exec(ctx, query,
		k.ID,
		k.TenantID,
		k.CreatedBy,
		k.Name,
		k.KeyPrefix,
		k.KeyHash,
		k.Status,
		permissionsJSON,
		k.RateLimitRPM,
		k.RateLimitTPM,
		k.AllowedModels,
		k.ExpiresAt,
		k.CreatedAt,
		k.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert api key: %w", err)
	}

	return nil
}

// GetByHash retrieves an API key by its hash, excluding revoked keys.
func (r *APIKeyRepository) GetByHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
	query := `
		SELECT id, tenant_id, created_by, name, key_prefix, key_hash, status, permissions, 
		       rate_limit_rpm, rate_limit_tpm, allowed_models, expires_at, last_used_at, created_at, updated_at, revoked_at
		FROM api_keys
		WHERE key_hash = $1 AND status = 'active'
	`

	return r.scanAPIKey(ctx, query, keyHash)
}

// GetByID retrieves an API key by ID.
func (r *APIKeyRepository) GetByID(ctx context.Context, id string) (*domain.APIKey, error) {
	query := `
		SELECT id, tenant_id, created_by, name, key_prefix, key_hash, status, permissions, 
		       rate_limit_rpm, rate_limit_tpm, allowed_models, expires_at, last_used_at, created_at, updated_at, revoked_at
		FROM api_keys
		WHERE id = $1
	`

	return r.scanAPIKey(ctx, query, id)
}

// ListByTenantID retrieves all API keys for a tenant.
func (r *APIKeyRepository) ListByTenantID(ctx context.Context, tenantID string) ([]*domain.APIKey, error) {
	query := `
		SELECT id, tenant_id, created_by, name, key_prefix, key_hash, status, permissions, 
		       rate_limit_rpm, rate_limit_tpm, allowed_models, expires_at, last_used_at, created_at, updated_at, revoked_at
		FROM api_keys
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.pool.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query api keys: %w", err)
	}
	defer rows.Close()

	var keys []*domain.APIKey
	for rows.Next() {
		k, err := r.scanAPIKeyFromRow(rows)
		if err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate api keys: %w", err)
	}

	return keys, nil
}

// Revoke marks an API key as revoked.
func (r *APIKeyRepository) Revoke(ctx context.Context, id string) error {
	query := `
		UPDATE api_keys
		SET status = $2, revoked_at = $3, updated_at = $3
		WHERE id = $1 AND status = 'active'
	`

	now := time.Now()
	result, err := r.db.pool.Exec(ctx, query, id, domain.APIKeyStatusRevoked, now)
	if err != nil {
		return fmt.Errorf("revoke api key: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("api key not found or already revoked")
	}

	return nil
}

// SoftDelete performs a soft delete by revoking the key (API keys don't have deleted_at, only revoked_at).
func (r *APIKeyRepository) SoftDelete(ctx context.Context, id string) error {
	return r.Revoke(ctx, id)
}

// UpdateLastUsed updates the last_used_at timestamp for an API key.
func (r *APIKeyRepository) UpdateLastUsed(ctx context.Context, id string) error {
	query := `
		UPDATE api_keys
		SET last_used_at = $2
		WHERE id = $1 AND status = 'active'
	`

	now := time.Now()
	_, err := r.db.pool.Exec(ctx, query, id, now)
	if err != nil {
		return fmt.Errorf("update last used: %w", err)
	}

	return nil
}

// scanAPIKey scans a single API key row from the database.
func (r *APIKeyRepository) scanAPIKey(ctx context.Context, query string, args ...interface{}) (*domain.APIKey, error) {
	row := r.db.pool.QueryRow(ctx, query, args...)

	var k domain.APIKey
	var permissionsJSON []byte

	err := row.Scan(
		&k.ID,
		&k.TenantID,
		&k.CreatedBy,
		&k.Name,
		&k.KeyPrefix,
		&k.KeyHash,
		&k.Status,
		&permissionsJSON,
		&k.RateLimitRPM,
		&k.RateLimitTPM,
		&k.AllowedModels,
		&k.ExpiresAt,
		&k.LastUsedAt,
		&k.CreatedAt,
		&k.UpdatedAt,
		&k.RevokedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("api key not found")
		}
		return nil, fmt.Errorf("scan api key: %w", err)
	}

	if len(permissionsJSON) > 0 {
		if err := json.Unmarshal(permissionsJSON, &k.Permissions); err != nil {
			return nil, fmt.Errorf("unmarshal permissions: %w", err)
		}
	}
	if k.Permissions == nil {
		k.Permissions = make(domain.JSONMap)
	}

	return &k, nil
}

// scanAPIKeyFromRow scans an API key from an existing row iterator.
func (r *APIKeyRepository) scanAPIKeyFromRow(rows pgx.Rows) (*domain.APIKey, error) {
	var k domain.APIKey
	var permissionsJSON []byte

	err := rows.Scan(
		&k.ID,
		&k.TenantID,
		&k.CreatedBy,
		&k.Name,
		&k.KeyPrefix,
		&k.KeyHash,
		&k.Status,
		&permissionsJSON,
		&k.RateLimitRPM,
		&k.RateLimitTPM,
		&k.AllowedModels,
		&k.ExpiresAt,
		&k.LastUsedAt,
		&k.CreatedAt,
		&k.UpdatedAt,
		&k.RevokedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan api key row: %w", err)
	}

	if len(permissionsJSON) > 0 {
		if err := json.Unmarshal(permissionsJSON, &k.Permissions); err != nil {
			return nil, fmt.Errorf("unmarshal permissions: %w", err)
		}
	}
	if k.Permissions == nil {
		k.Permissions = make(domain.JSONMap)
	}

	return &k, nil
}

// AdminAPIKey represents an API key with additional info for admin view
type AdminAPIKey struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	TenantID   string     `json:"tenant_id"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
	Status     string     `json:"status"`
}

// ListAllKeys retrieves all API keys across all tenants with pagination.
func (r *APIKeyRepository) ListAllKeys(ctx context.Context, page, perPage int, tenantFilter string) ([]AdminAPIKey, int, error) {
	// Build count query
	countQuery := `SELECT COUNT(*) FROM api_keys WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if tenantFilter != "" {
		countQuery += fmt.Sprintf(" AND tenant_id = $%d", argIndex)
		args = append(args, tenantFilter)
		argIndex++
	}

	var totalCount int
	err := r.db.pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("count api keys: %w", err)
	}

	offset := (page - 1) * perPage
	if offset < 0 {
		offset = 0
	}

	// Build main query
	query := `
		SELECT id, name, key_prefix, tenant_id, created_at, last_used_at, status
		FROM api_keys
		WHERE 1=1
	`

	args = []interface{}{}
	argIndex = 1

	if tenantFilter != "" {
		query += fmt.Sprintf(" AND tenant_id = $%d", argIndex)
		args = append(args, tenantFilter)
		argIndex++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, perPage, offset)

	rows, err := r.db.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query api keys: %w", err)
	}
	defer rows.Close()

	var keys []AdminAPIKey
	for rows.Next() {
		var k AdminAPIKey
		err := rows.Scan(
			&k.ID,
			&k.Name,
			&k.Prefix,
			&k.TenantID,
			&k.CreatedAt,
			&k.LastUsedAt,
			&k.Status,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan api key row: %w", err)
		}
		keys = append(keys, k)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate api keys: %w", err)
	}

	return keys, totalCount, nil
}
