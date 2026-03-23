package router

import (
	"context"
	"fmt"
	"sync/atomic"

	"github.com/hi-ai/gateway/internal/domain"
)

// Single routes all requests to a single target.
type Single struct {
	targets []domain.RoutingTarget
}

// NewSingle creates a new single-target router.
func NewSingle(rule *domain.RoutingRule) *Single {
	return &Single{
		targets: rule.Targets,
	}
}

func (s *Single) Route(_ context.Context, _ *domain.RoutingRequest) ([]domain.RoutingTarget, error) {
	if len(s.targets) == 0 {
		return nil, fmt.Errorf("no targets configured for single routing")
	}
	return s.targets[:1], nil
}

// Fallback routes requests through an ordered chain of targets.
type Fallback struct {
	targets []domain.RoutingTarget
}

// NewFallback creates a new fallback router.
func NewFallback(rule *domain.RoutingRule) *Fallback {
	return &Fallback{
		targets: rule.Targets,
	}
}

func (f *Fallback) Route(_ context.Context, _ *domain.RoutingRequest) ([]domain.RoutingTarget, error) {
	if len(f.targets) == 0 {
		return nil, fmt.Errorf("no targets configured for fallback routing")
	}
	return f.targets, nil
}

// LoadBalance routes requests using weighted round-robin.
type LoadBalance struct {
	targets     []domain.RoutingTarget
	counter     uint64
	totalWeight int
}

// NewLoadBalance creates a new load-balance router.
func NewLoadBalance(rule *domain.RoutingRule) *LoadBalance {
	totalWeight := 0
	for _, t := range rule.Targets {
		weight := t.Weight
		if weight <= 0 {
			weight = 1 // Default weight
		}
		totalWeight += weight
	}
	return &LoadBalance{
		targets:     rule.Targets,
		totalWeight: totalWeight,
	}
}

func (lb *LoadBalance) Route(_ context.Context, _ *domain.RoutingRequest) ([]domain.RoutingTarget, error) {
	if len(lb.targets) == 0 {
		return nil, fmt.Errorf("no targets configured for load-balance routing")
	}

	// Get the current counter value and increment atomically
	counter := atomic.AddUint64(&lb.counter, 1) - 1

	// Check if all weights are equal (or all default)
	allEqual := true
	firstWeight := lb.targets[0].Weight
	if firstWeight <= 0 {
		firstWeight = 1
	}
	for _, t := range lb.targets {
		w := t.Weight
		if w <= 0 {
			w = 1
		}
		if w != firstWeight {
			allEqual = false
			break
		}
	}

	var selectedIdx int

	if allEqual {
		// Simple round-robin when all weights are equal
		selectedIdx = int(counter % uint64(len(lb.targets)))
	} else {
		// Weighted round-robin
		// Use modulo of total weight to determine selection
		pos := int(counter % uint64(lb.totalWeight))
		cumulative := 0
		for i, t := range lb.targets {
			weight := t.Weight
			if weight <= 0 {
				weight = 1
			}
			cumulative += weight
			if pos < cumulative {
				selectedIdx = i
				break
			}
		}
	}

	// Return selected target first, then the rest as fallbacks
	result := make([]domain.RoutingTarget, 0, len(lb.targets))
	result = append(result, lb.targets[selectedIdx])
	for i, t := range lb.targets {
		if i != selectedIdx {
			result = append(result, t)
		}
	}
	return result, nil
}
