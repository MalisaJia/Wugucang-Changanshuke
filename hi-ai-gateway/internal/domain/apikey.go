package domain

import "time"

// APIKey represents a virtual API key for accessing the gateway.
type APIKey struct {
	ID           string     `json:"id" db:"id"`
	TenantID     string     `json:"tenant_id" db:"tenant_id"`
	CreatedBy    *string    `json:"created_by,omitempty" db:"created_by"`
	Name         string     `json:"name" db:"name"`
	KeyPrefix    string     `json:"key_prefix" db:"key_prefix"`
	KeyHash      string     `json:"-" db:"key_hash"`
	Status       string     `json:"status" db:"status"`
	Permissions  JSONMap    `json:"permissions" db:"permissions"`
	RateLimitRPM *int       `json:"rate_limit_rpm,omitempty" db:"rate_limit_rpm"`
	RateLimitTPM *int       `json:"rate_limit_tpm,omitempty" db:"rate_limit_tpm"`
	AllowedModels []string  `json:"allowed_models,omitempty" db:"allowed_models"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	LastUsedAt   *time.Time `json:"last_used_at,omitempty" db:"last_used_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	RevokedAt    *time.Time `json:"revoked_at,omitempty" db:"revoked_at"`
}

// APIKeyStatus constants.
const (
	APIKeyStatusActive  = "active"
	APIKeyStatusRevoked = "revoked"
	APIKeyStatusExpired = "expired"
)

// APIKeyPrefix is the standard prefix for all Hi AI API keys.
const APIKeyPrefix = "hiai-"

// IsActive checks if the key is currently usable.
func (k *APIKey) IsActive() bool {
	if k.Status != APIKeyStatusActive {
		return false
	}
	if k.ExpiresAt != nil && time.Now().After(*k.ExpiresAt) {
		return false
	}
	return true
}

// IsModelAllowed checks if the given model is allowed for this key.
func (k *APIKey) IsModelAllowed(model string) bool {
	if len(k.AllowedModels) == 0 {
		return true // no restrictions
	}
	for _, m := range k.AllowedModels {
		if m == model {
			return true
		}
	}
	return false
}
