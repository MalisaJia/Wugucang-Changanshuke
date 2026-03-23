package domain

import (
	"time"

	"github.com/google/uuid"
)

// ProviderConfig represents per-tenant configuration for a provider.
type ProviderConfig struct {
	ID              uuid.UUID `json:"id" db:"id"`
	TenantID        uuid.UUID `json:"tenant_id" db:"tenant_id"`
	ProviderID      string    `json:"provider_id" db:"provider_id"`
	APIKeyEncrypted string    `json:"-" db:"api_key_encrypted"`
	BaseURL         string    `json:"base_url,omitempty" db:"base_url"`
	Enabled         bool      `json:"enabled" db:"enabled"`
	Priority        int       `json:"priority" db:"priority"`
	Weight          int       `json:"weight" db:"weight"`
	Settings        JSONMap   `json:"settings" db:"settings"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// HasAPIKey returns true if the provider config has an API key configured.
func (p *ProviderConfig) HasAPIKey() bool {
	return p.APIKeyEncrypted != ""
}
