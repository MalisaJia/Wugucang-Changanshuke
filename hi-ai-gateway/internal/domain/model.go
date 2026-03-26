package domain

import (
	"time"

	"github.com/google/uuid"
)

// ModelConfig represents platform-wide model configuration.
// This is managed by platform admins and controls model visibility,
// display information, and pricing for all users.
type ModelConfig struct {
	ID           uuid.UUID `json:"id" db:"id"`
	ModelID      string    `json:"model_id" db:"model_id"`
	DisplayName  string    `json:"display_name" db:"display_name"`
	Description  string    `json:"description" db:"description"`
	ProviderName string    `json:"provider_name" db:"provider_name"`
	Priority     int       `json:"priority" db:"priority"`
	Visible      bool      `json:"visible" db:"visible"`
	Tags         string    `json:"tags" db:"tags"`
	PriceInput   float64   `json:"price_input" db:"price_input"`
	PriceOutput  float64   `json:"price_output" db:"price_output"`
	MaxContext   int       `json:"max_context" db:"max_context"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// PriorityUpdate is used for batch updating model priorities.
type PriorityUpdate struct {
	ID       uuid.UUID `json:"id"`
	Priority int       `json:"priority"`
}
