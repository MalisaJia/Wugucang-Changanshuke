package domain

// RoutingMode defines the routing strategy type.
type RoutingMode string

const (
	RoutingModeSingle      RoutingMode = "single"
	RoutingModeFallback    RoutingMode = "fallback"
	RoutingModeLoadBalance RoutingMode = "loadbalance"
	RoutingModeConditional RoutingMode = "conditional"
)

// RoutingRule defines a routing configuration for a tenant.
type RoutingRule struct {
	ID             string      `json:"id" db:"id"`
	TenantID       string      `json:"tenant_id" db:"tenant_id"`
	Name           string      `json:"name" db:"name"`
	Mode           RoutingMode `json:"mode" db:"mode"`
	Priority       int         `json:"priority" db:"priority"`
	IsEnabled      bool        `json:"is_enabled" db:"is_enabled"`
	MatchCriteria  JSONMap     `json:"match_criteria" db:"match_criteria"`
	Targets        []RoutingTarget `json:"targets"`
	FallbackConfig JSONMap     `json:"fallback_config" db:"fallback_config"`
}

// RoutingTarget defines a single target in a routing rule.
type RoutingTarget struct {
	ProviderID string `json:"provider_id"`
	ModelID    string `json:"model_id"`
	Weight     int    `json:"weight,omitempty"`
	Priority   int    `json:"priority,omitempty"`
}

// RoutingRequest holds the context needed for routing decisions.
type RoutingRequest struct {
	TenantID      string
	ModelID       string
	ContentLength int                    // Total content length of messages (for conditional routing)
	Metadata      map[string]interface{}
}
