package middleware

import (
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/sony/gobreaker/v2"
	"github.com/hi-ai/gateway/internal/telemetry"
)

// BreakerConfig holds circuit breaker configuration
type BreakerConfig struct {
	FailureThreshold uint32        // failures before open (default 5)
	SuccessThreshold uint32        // successes in half-open before close (default 2)
	Timeout          time.Duration // time in open state before half-open (default 30s)
	Window           time.Duration // rolling window for failure counting (default 60s)
}

// DefaultBreakerConfig returns sensible default configuration
func DefaultBreakerConfig() BreakerConfig {
	return BreakerConfig{
		FailureThreshold: 5,
		SuccessThreshold: 2,
		Timeout:          30 * time.Second,
		Window:           60 * time.Second,
	}
}

// BreakerPool manages per-provider:model circuit breakers
type BreakerPool struct {
	mu       sync.RWMutex
	breakers map[string]*gobreaker.CircuitBreaker[any]
	config   BreakerConfig
}

// NewBreakerPool creates a new BreakerPool with the given configuration
func NewBreakerPool(cfg BreakerConfig) *BreakerPool {
	// Apply defaults for zero values
	if cfg.FailureThreshold == 0 {
		cfg.FailureThreshold = 5
	}
	if cfg.SuccessThreshold == 0 {
		cfg.SuccessThreshold = 2
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.Window == 0 {
		cfg.Window = 60 * time.Second
	}

	return &BreakerPool{
		breakers: make(map[string]*gobreaker.CircuitBreaker[any]),
		config:   cfg,
	}
}

// makeKey creates a breaker key from provider and model IDs
func makeKey(providerID, modelID string) string {
	return fmt.Sprintf("%s:%s", providerID, modelID)
}

// GetBreaker returns or creates a circuit breaker for the given key (format: "provider_id:model_id")
func (p *BreakerPool) GetBreaker(providerID, modelID string) *gobreaker.CircuitBreaker[any] {
	key := makeKey(providerID, modelID)

	// Fast path: check if breaker already exists
	p.mu.RLock()
	cb, exists := p.breakers[key]
	p.mu.RUnlock()
	if exists {
		return cb
	}

	// Slow path: create new breaker
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check after acquiring write lock
	if cb, exists = p.breakers[key]; exists {
		return cb
	}

	// Create new circuit breaker with settings
	settings := gobreaker.Settings{
		Name:        key,
		MaxRequests: p.config.SuccessThreshold,
		Interval:    p.config.Window,
		Timeout:     p.config.Timeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= p.config.FailureThreshold
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			slog.Warn("circuit breaker state changed",
				"name", name,
				"provider", providerID,
				"model", modelID,
				"from", stateString(from),
				"to", stateString(to),
			)
			// Update Prometheus metric
			telemetry.CircuitBreakerState.WithLabelValues(providerID, modelID).Set(float64(to))
		},
	}

	cb = gobreaker.NewCircuitBreaker[any](settings)
	p.breakers[key] = cb
	return cb
}

// Execute wraps a function call with circuit breaker protection
func (p *BreakerPool) Execute(providerID, modelID string, fn func() (any, error)) (any, error) {
	cb := p.GetBreaker(providerID, modelID)
	return cb.Execute(fn)
}

// State returns the current state of a breaker
func (p *BreakerPool) State(providerID, modelID string) gobreaker.State {
	cb := p.GetBreaker(providerID, modelID)
	return cb.State()
}

// IsAvailable checks if the circuit breaker allows requests (not in open state)
func (p *BreakerPool) IsAvailable(providerID, modelID string) bool {
	return p.State(providerID, modelID) != gobreaker.StateOpen
}

// BreakerStatus represents the status of a single circuit breaker
type BreakerStatus struct {
	Key      string `json:"key"`
	State    string `json:"state"`
	Failures uint32 `json:"failures"`
}

// ListAll returns the status of all circuit breakers in the pool
func (p *BreakerPool) ListAll() []BreakerStatus {
	p.mu.RLock()
	defer p.mu.RUnlock()

	result := make([]BreakerStatus, 0, len(p.breakers))
	for key, cb := range p.breakers {
		counts := cb.Counts()
		result = append(result, BreakerStatus{
			Key:      key,
			State:    stateString(cb.State()),
			Failures: counts.ConsecutiveFailures,
		})
	}

	return result
}

// GetConfig returns the current circuit breaker configuration
func (p *BreakerPool) GetConfig() BreakerConfig {
	return p.config
}

// stateString converts gobreaker.State to a human-readable string
func stateString(s gobreaker.State) string {
	switch s {
	case gobreaker.StateClosed:
		return "closed"
	case gobreaker.StateHalfOpen:
		return "half-open"
	case gobreaker.StateOpen:
		return "open"
	default:
		return "unknown"
	}
}
