package domain

import "time"

// Tenant represents a multi-tenant organization.
type Tenant struct {
	ID           string     `json:"id" db:"id"`
	Name         string     `json:"name" db:"name"`
	Slug         string     `json:"slug" db:"slug"`
	Plan         string     `json:"plan" db:"plan"`
	Status       string     `json:"status" db:"status"`
	Settings     JSONMap    `json:"settings" db:"settings"`
	RateLimitRPM int        `json:"rate_limit_rpm" db:"rate_limit_rpm"`
	RateLimitTPM int        `json:"rate_limit_tpm" db:"rate_limit_tpm"`
	MaxKeys      int        `json:"max_keys" db:"max_keys"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

// User represents a user within a tenant.
type User struct {
	ID           string     `json:"id" db:"id"`
	TenantID     string     `json:"tenant_id" db:"tenant_id"`
	Email        string     `json:"email" db:"email"`
	PasswordHash string     `json:"-" db:"password_hash"`
	DisplayName  string     `json:"display_name" db:"display_name"`
	Role         Role       `json:"role" db:"role"`
	Status       string     `json:"status" db:"status"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

// Role defines user permission levels.
type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
	RoleViewer Role = "viewer"
)

// HasPermission checks if the role has at least the given permission level.
func (r Role) HasPermission(required Role) bool {
	levels := map[Role]int{
		RoleOwner:  4,
		RoleAdmin:  3,
		RoleMember: 2,
		RoleViewer: 1,
	}
	return levels[r] >= levels[required]
}

// TenantStatus constants.
const (
	TenantStatusActive    = "active"
	TenantStatusSuspended = "suspended"
	TenantStatusDeleted   = "deleted"
)

// Plan constants.
const (
	PlanFree       = "free"
	PlanStarter    = "starter"
	PlanPro        = "pro"
	PlanEnterprise = "enterprise"
)

// JSONMap is a helper type for JSONB columns.
type JSONMap map[string]interface{}
