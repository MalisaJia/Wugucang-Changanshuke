package router

import (
	"context"

	"github.com/hi-ai/gateway/internal/domain"
)

// Router defines the interface for routing strategies.
type Router interface {
	// Route selects one or more targets for the given routing request.
	// Returns an ordered slice: the first target should be tried first.
	Route(ctx context.Context, req *domain.RoutingRequest) ([]domain.RoutingTarget, error)
}

// NewRouter creates a router based on the routing mode.
func NewRouter(mode domain.RoutingMode, rule *domain.RoutingRule) Router {
	switch mode {
	case domain.RoutingModeSingle:
		return NewSingle(rule)
	case domain.RoutingModeFallback:
		return NewFallback(rule)
	case domain.RoutingModeLoadBalance:
		return NewLoadBalance(rule)
	default:
		return NewSingle(rule)
	}
}
