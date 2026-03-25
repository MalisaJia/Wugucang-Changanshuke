package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/hi-ai/gateway/internal/domain"
)

// UserRepository handles user persistence operations.
type UserRepository struct {
	db *DB
}

// NewUserRepository creates a new UserRepository.
func NewUserRepository(db *DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create inserts a new user into the database.
func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	query := `
		INSERT INTO users (id, tenant_id, email, password_hash, display_name, role, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := r.db.pool.Exec(ctx, query,
		u.ID,
		u.TenantID,
		u.Email,
		u.PasswordHash,
		u.DisplayName,
		u.Role,
		u.Status,
		u.CreatedAt,
		u.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}

	return nil
}

// GetByID retrieves a user by ID, excluding soft-deleted records.
func (r *UserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	query := `
		SELECT id, tenant_id, email, password_hash, display_name, role, status, last_login_at, created_at, updated_at, deleted_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`

	return r.scanUser(ctx, query, id)
}

// GetByEmail retrieves a user by email within a specific tenant, excluding soft-deleted records.
func (r *UserRepository) GetByEmail(ctx context.Context, tenantID string, email string) (*domain.User, error) {
	query := `
		SELECT id, tenant_id, email, password_hash, display_name, role, status, last_login_at, created_at, updated_at, deleted_at
		FROM users
		WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL
	`

	return r.scanUser(ctx, query, tenantID, email)
}

// GetByEmailGlobal retrieves a user by email across all tenants, excluding soft-deleted records.
// This is useful for login where the tenant context may not be known yet.
func (r *UserRepository) GetByEmailGlobal(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT id, tenant_id, email, password_hash, display_name, role, status, last_login_at, created_at, updated_at, deleted_at
		FROM users
		WHERE email = $1 AND deleted_at IS NULL
		LIMIT 1
	`

	return r.scanUser(ctx, query, email)
}

// GetByTenantID retrieves all users for a tenant, excluding soft-deleted records.
func (r *UserRepository) GetByTenantID(ctx context.Context, tenantID string) ([]*domain.User, error) {
	query := `
		SELECT id, tenant_id, email, password_hash, display_name, role, status, last_login_at, created_at, updated_at, deleted_at
		FROM users
		WHERE tenant_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC
	`

	rows, err := r.db.pool.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query users: %w", err)
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		u, err := r.scanUserFromRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

// Update updates an existing user.
func (r *UserRepository) Update(ctx context.Context, u *domain.User) error {
	query := `
		UPDATE users
		SET email = $2, password_hash = $3, display_name = $4, role = $5, status = $6, updated_at = $7
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.pool.Exec(ctx, query,
		u.ID,
		u.Email,
		u.PasswordHash,
		u.DisplayName,
		u.Role,
		u.Status,
		time.Now(),
	)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("user not found or already deleted")
	}

	return nil
}

// UpdateLastLogin updates the last login timestamp for a user.
func (r *UserRepository) UpdateLastLogin(ctx context.Context, id string) error {
	query := `
		UPDATE users
		SET last_login_at = $2, updated_at = $2
		WHERE id = $1 AND deleted_at IS NULL
	`

	now := time.Now()
	result, err := r.db.pool.Exec(ctx, query, id, now)
	if err != nil {
		return fmt.Errorf("update last login: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("user not found or already deleted")
	}

	return nil
}

// SoftDelete marks a user as deleted without removing the record.
func (r *UserRepository) SoftDelete(ctx context.Context, id string) error {
	query := `
		UPDATE users
		SET deleted_at = $2, updated_at = $2
		WHERE id = $1 AND deleted_at IS NULL
	`

	now := time.Now()
	result, err := r.db.pool.Exec(ctx, query, id, now)
	if err != nil {
		return fmt.Errorf("soft delete user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("user not found or already deleted")
	}

	return nil
}

// scanUser scans a single user row from the database.
func (r *UserRepository) scanUser(ctx context.Context, query string, args ...interface{}) (*domain.User, error) {
	row := r.db.pool.QueryRow(ctx, query, args...)

	var u domain.User
	err := row.Scan(
		&u.ID,
		&u.TenantID,
		&u.Email,
		&u.PasswordHash,
		&u.DisplayName,
		&u.Role,
		&u.Status,
		&u.LastLoginAt,
		&u.CreatedAt,
		&u.UpdatedAt,
		&u.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("scan user: %w", err)
	}

	return &u, nil
}

// scanUserFromRow scans a user from an existing row iterator.
func (r *UserRepository) scanUserFromRow(rows pgx.Rows) (*domain.User, error) {
	var u domain.User
	err := rows.Scan(
		&u.ID,
		&u.TenantID,
		&u.Email,
		&u.PasswordHash,
		&u.DisplayName,
		&u.Role,
		&u.Status,
		&u.LastLoginAt,
		&u.CreatedAt,
		&u.UpdatedAt,
		&u.DeletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan user row: %w", err)
	}

	return &u, nil
}

// =====================
// Admin/Global Queries
// =====================

// AdminUser represents a user with balance for admin views.
type AdminUser struct {
	ID          string     `json:"id"`
	TenantID    string     `json:"tenant_id"`
	Email       string     `json:"email"`
	DisplayName string     `json:"display_name"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	Balance     int64      `json:"balance"`
	CreatedAt   time.Time  `json:"created_at"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
}

// ListAllUsers retrieves all users across all tenants with their balance (for admin).
// Supports pagination and optional email search.
func (r *UserRepository) ListAllUsers(ctx context.Context, page, perPage int, emailSearch string) ([]AdminUser, int, error) {
	// Build count query
	countQuery := `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`
	args := []interface{}{}
	argIndex := 1

	if emailSearch != "" {
		countQuery += fmt.Sprintf(" AND email ILIKE $%d", argIndex)
		args = append(args, "%"+emailSearch+"%")
		argIndex++
	}

	var totalCount int
	err := r.db.pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	// Calculate offset
	offset := (page - 1) * perPage
	if offset < 0 {
		offset = 0
	}

	// Build main query with LEFT JOIN to balances
	query := `
		SELECT 
			u.id, u.tenant_id, u.email, u.display_name, u.role, u.status, 
			COALESCE(b.amount_balance, 0) as balance,
			u.created_at, u.last_login_at
		FROM users u
		LEFT JOIN balances b ON u.tenant_id = b.tenant_id
		WHERE u.deleted_at IS NULL
	`

	queryArgs := []interface{}{}
	queryArgIndex := 1

	if emailSearch != "" {
		query += fmt.Sprintf(" AND u.email ILIKE $%d", queryArgIndex)
		queryArgs = append(queryArgs, "%"+emailSearch+"%")
		queryArgIndex++
	}

	query += fmt.Sprintf(" ORDER BY u.created_at DESC LIMIT $%d OFFSET $%d", queryArgIndex, queryArgIndex+1)
	queryArgs = append(queryArgs, perPage, offset)

	rows, err := r.db.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("query users: %w", err)
	}
	defer rows.Close()

	var users []AdminUser
	for rows.Next() {
		var u AdminUser
		err := rows.Scan(
			&u.ID, &u.TenantID, &u.Email, &u.DisplayName, &u.Role, &u.Status,
			&u.Balance, &u.CreatedAt, &u.LastLoginAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan user row: %w", err)
		}
		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate users: %w", err)
	}

	return users, totalCount, nil
}

// GetRecentUsers retrieves the most recently registered users (for admin dashboard).
func (r *UserRepository) GetRecentUsers(ctx context.Context, limit int) ([]AdminUser, error) {
	query := `
		SELECT 
			u.id, u.tenant_id, u.email, u.display_name, u.role, u.status, 
			COALESCE(b.amount_balance, 0) as balance,
			u.created_at, u.last_login_at
		FROM users u
		LEFT JOIN balances b ON u.tenant_id = b.tenant_id
		WHERE u.deleted_at IS NULL
		ORDER BY u.created_at DESC
		LIMIT $1
	`

	rows, err := r.db.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query recent users: %w", err)
	}
	defer rows.Close()

	var users []AdminUser
	for rows.Next() {
		var u AdminUser
		err := rows.Scan(
			&u.ID, &u.TenantID, &u.Email, &u.DisplayName, &u.Role, &u.Status,
			&u.Balance, &u.CreatedAt, &u.LastLoginAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan user row: %w", err)
		}
		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

// CountTotalUsers returns the total count of non-deleted users.
func (r *UserRepository) CountTotalUsers(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`
	var count int64
	err := r.db.pool.QueryRow(ctx, query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count users: %w", err)
	}
	return count, nil
}

// CountActiveUsersToday returns the number of users who logged in today.
func (r *UserRepository) CountActiveUsersToday(ctx context.Context) (int64, error) {
	query := `
		SELECT COUNT(*) FROM users 
		WHERE deleted_at IS NULL 
		AND last_login_at >= CURRENT_DATE
	`
	var count int64
	err := r.db.pool.QueryRow(ctx, query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count active users: %w", err)
	}
	return count, nil
}
