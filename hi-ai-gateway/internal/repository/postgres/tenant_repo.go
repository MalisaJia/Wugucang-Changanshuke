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

// TenantRepository handles tenant persistence operations.
type TenantRepository struct {
	db *DB
}

// NewTenantRepository creates a new TenantRepository.
func NewTenantRepository(db *DB) *TenantRepository {
	return &TenantRepository{db: db}
}

// Create inserts a new tenant into the database.
func (r *TenantRepository) Create(ctx context.Context, t *domain.Tenant) error {
	settingsJSON, err := json.Marshal(t.Settings)
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}

	query := `
		INSERT INTO tenants (id, name, slug, plan, status, settings, rate_limit_rpm, rate_limit_tpm, max_keys, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err = r.db.pool.Exec(ctx, query,
		t.ID,
		t.Name,
		t.Slug,
		t.Plan,
		t.Status,
		settingsJSON,
		t.RateLimitRPM,
		t.RateLimitTPM,
		t.MaxKeys,
		t.CreatedAt,
		t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert tenant: %w", err)
	}

	return nil
}

// GetByID retrieves a tenant by ID, excluding soft-deleted records.
func (r *TenantRepository) GetByID(ctx context.Context, id string) (*domain.Tenant, error) {
	query := `
		SELECT id, name, slug, plan, status, settings, rate_limit_rpm, rate_limit_tpm, max_keys, created_at, updated_at, deleted_at
		FROM tenants
		WHERE id = $1 AND deleted_at IS NULL
	`

	return r.scanTenant(ctx, query, id)
}

// GetBySlug retrieves a tenant by slug, excluding soft-deleted records.
func (r *TenantRepository) GetBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	query := `
		SELECT id, name, slug, plan, status, settings, rate_limit_rpm, rate_limit_tpm, max_keys, created_at, updated_at, deleted_at
		FROM tenants
		WHERE slug = $1 AND deleted_at IS NULL
	`

	return r.scanTenant(ctx, query, slug)
}

// Update updates an existing tenant.
func (r *TenantRepository) Update(ctx context.Context, t *domain.Tenant) error {
	settingsJSON, err := json.Marshal(t.Settings)
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}

	query := `
		UPDATE tenants
		SET name = $2, slug = $3, plan = $4, status = $5, settings = $6, 
		    rate_limit_rpm = $7, rate_limit_tpm = $8, max_keys = $9, updated_at = $10
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.pool.Exec(ctx, query,
		t.ID,
		t.Name,
		t.Slug,
		t.Plan,
		t.Status,
		settingsJSON,
		t.RateLimitRPM,
		t.RateLimitTPM,
		t.MaxKeys,
		time.Now(),
	)
	if err != nil {
		return fmt.Errorf("update tenant: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("tenant not found or already deleted")
	}

	return nil
}

// SoftDelete marks a tenant as deleted without removing the record.
func (r *TenantRepository) SoftDelete(ctx context.Context, id string) error {
	query := `
		UPDATE tenants
		SET deleted_at = $2, updated_at = $2, status = $3
		WHERE id = $1 AND deleted_at IS NULL
	`

	now := time.Now()
	result, err := r.db.pool.Exec(ctx, query, id, now, domain.TenantStatusDeleted)
	if err != nil {
		return fmt.Errorf("soft delete tenant: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("tenant not found or already deleted")
	}

	return nil
}

// scanTenant scans a single tenant row from the database.
func (r *TenantRepository) scanTenant(ctx context.Context, query string, args ...interface{}) (*domain.Tenant, error) {
	row := r.db.pool.QueryRow(ctx, query, args...)

	var t domain.Tenant
	var settingsJSON []byte

	err := row.Scan(
		&t.ID,
		&t.Name,
		&t.Slug,
		&t.Plan,
		&t.Status,
		&settingsJSON,
		&t.RateLimitRPM,
		&t.RateLimitTPM,
		&t.MaxKeys,
		&t.CreatedAt,
		&t.UpdatedAt,
		&t.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("tenant not found")
		}
		return nil, fmt.Errorf("scan tenant: %w", err)
	}

	if len(settingsJSON) > 0 {
		if err := json.Unmarshal(settingsJSON, &t.Settings); err != nil {
			return nil, fmt.Errorf("unmarshal settings: %w", err)
		}
	}
	if t.Settings == nil {
		t.Settings = make(domain.JSONMap)
	}

	return &t, nil
}
