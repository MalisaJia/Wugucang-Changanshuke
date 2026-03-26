package middleware

import (
	"container/list"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/sony/gobreaker/v2"
	"github.com/hi-ai/gateway/internal/telemetry"
)

const (
	// Fix: prevent breaker pool memory leak under high cardinality
	maxBreakerPoolSize    = 10000             // Cap the pool at 10K entries max
	breakerCleanupInterval = 5 * time.Minute  // Cleanup interval
	breakerStaleTTL       = 30 * time.Minute  // Evict breakers not accessed in 30 minutes
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

// breakerEntry holds a circuit breaker with LRU metadata
type breakerEntry struct {
	cb         *gobreaker.CircuitBreaker[any]
	key        string
	lastAccess time.Time
	lruElement *list.Element // Pointer to LRU list element for O(1) removal
}

// BreakerPool manages per-provider:model circuit breakers with LRU eviction
// Fix: Added LRU eviction and TTL-based cleanup to prevent memory leak
type BreakerPool struct {
	mu       sync.RWMutex
	breakers map[string]*breakerEntry
	lruList  *list.List // LRU list for eviction (front = most recently used)
	config   BreakerConfig
	stopCh   chan struct{} // Channel to stop background cleanup goroutine
}

// NewBreakerPool creates a new BreakerPool with the given configuration
// Fix: Now starts a background goroutine for TTL-based cleanup
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

	pool := &BreakerPool{
		breakers: make(map[string]*breakerEntry),
		lruList:  list.New(),
		config:   cfg,
		stopCh:   make(chan struct{}),
	}

	// Start background cleanup goroutine
	go pool.cleanupLoop()

	return pool
}

// Stop stops the background cleanup goroutine
func (p *BreakerPool) Stop() {
	close(p.stopCh)
}

// cleanupLoop periodically removes stale breakers that haven't been accessed
func (p *BreakerPool) cleanupLoop() {
	ticker := time.NewTicker(breakerCleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.cleanupStaleBreakers()
		case <-p.stopCh:
			return
		}
	}
}

// cleanupStaleBreakers removes breakers not accessed within the TTL
func (p *BreakerPool) cleanupStaleBreakers() {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now()
	staleThreshold := now.Add(-breakerStaleTTL)
	removedCount := 0

	// Iterate from back of LRU list (least recently used)
	for elem := p.lruList.Back(); elem != nil; {
		entry := elem.Value.(*breakerEntry)
		prev := elem.Prev()

		if entry.lastAccess.Before(staleThreshold) {
			// Remove stale entry
			p.lruList.Remove(elem)
			delete(p.breakers, entry.key)
			removedCount++
		} else {
			// Since list is ordered by access time, we can stop here
			break
		}
		elem = prev
	}

	if removedCount > 0 {
		slog.Info("cleaned up stale circuit breakers",
			"removed", removedCount,
			"remaining", len(p.breakers),
		)
	}
}

// makeKey creates a breaker key from provider and model IDs
func makeKey(providerID, modelID string) string {
	return fmt.Sprintf("%s:%s", providerID, modelID)
}

// GetBreaker returns or creates a circuit breaker for the given key (format: "provider_id:model_id")
// Fix: Now implements LRU eviction when pool is full
func (p *BreakerPool) GetBreaker(providerID, modelID string) *gobreaker.CircuitBreaker[any] {
	key := makeKey(providerID, modelID)
	now := time.Now()

	// Fast path: check if breaker already exists
	p.mu.RLock()
	entry, exists := p.breakers[key]
	p.mu.RUnlock()
	if exists {
		// Update access time and move to front of LRU list
		p.mu.Lock()
		entry.lastAccess = now
		p.lruList.MoveToFront(entry.lruElement)
		p.mu.Unlock()
		return entry.cb
	}

	// Slow path: create new breaker
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check after acquiring write lock
	if entry, exists = p.breakers[key]; exists {
		entry.lastAccess = now
		p.lruList.MoveToFront(entry.lruElement)
		return entry.cb
	}

	// Fix: Evict LRU entries if pool is at capacity
	for len(p.breakers) >= maxBreakerPoolSize {
		p.evictLRU()
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

	cb := gobreaker.NewCircuitBreaker[any](settings)
	entry = &breakerEntry{
		cb:         cb,
		key:        key,
		lastAccess: now,
	}
	entry.lruElement = p.lruList.PushFront(entry)
	p.breakers[key] = entry
	return cb
}

// evictLRU removes the least recently used breaker (must be called with lock held)
func (p *BreakerPool) evictLRU() {
	elem := p.lruList.Back()
	if elem == nil {
		return
	}
	entry := elem.Value.(*breakerEntry)
	p.lruList.Remove(elem)
	delete(p.breakers, entry.key)
	slog.Debug("evicted LRU circuit breaker", "key", entry.key, "pool_size", len(p.breakers))
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
	for key, entry := range p.breakers {
		counts := entry.cb.Counts()
		result = append(result, BreakerStatus{
			Key:      key,
			State:    stateString(entry.cb.State()),
			Failures: counts.ConsecutiveFailures,
		})
	}

	return result
}

// Size returns the current number of breakers in the pool
func (p *BreakerPool) Size() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.breakers)
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
