package service

import (
	"sync"
	"time"
)

// ProviderHealth tracks the health status of a provider.
type ProviderHealth struct {
	ProviderID    string
	ErrorCount    int
	TotalRequests int
	LastError     time.Time
	LastSuccess   time.Time
	IsHealthy     bool
}

// HealthTracker maintains health statistics for all providers.
type HealthTracker struct {
	mu        sync.RWMutex
	health    map[string]*ProviderHealth
	window    time.Duration // sliding window for error counting (e.g., 5 minutes)
	threshold int           // error count threshold to mark unhealthy (e.g., 5)
}

// NewHealthTracker creates a new HealthTracker with the given sliding window and error threshold.
func NewHealthTracker(window time.Duration, threshold int) *HealthTracker {
	if window <= 0 {
		window = 5 * time.Minute
	}
	if threshold <= 0 {
		threshold = 5
	}
	return &HealthTracker{
		health:    make(map[string]*ProviderHealth),
		window:    window,
		threshold: threshold,
	}
}

// getOrCreate returns the health record for a provider, creating it if necessary.
// Caller must hold at least a read lock; if creating, caller must hold write lock.
func (ht *HealthTracker) getOrCreateLocked(providerID string) *ProviderHealth {
	h, ok := ht.health[providerID]
	if !ok {
		h = &ProviderHealth{
			ProviderID: providerID,
			IsHealthy:  true,
		}
		ht.health[providerID] = h
	}
	return h
}

// RecordSuccess records a successful request to a provider.
func (ht *HealthTracker) RecordSuccess(providerID string) {
	ht.mu.Lock()
	defer ht.mu.Unlock()

	h := ht.getOrCreateLocked(providerID)
	h.TotalRequests++
	h.LastSuccess = time.Now()

	// Check if errors have aged out of the window
	ht.updateHealthStatusLocked(h)
}

// RecordError records a failed request to a provider.
func (ht *HealthTracker) RecordError(providerID string) {
	ht.mu.Lock()
	defer ht.mu.Unlock()

	h := ht.getOrCreateLocked(providerID)
	h.TotalRequests++
	h.ErrorCount++
	h.LastError = time.Now()

	// Update health status based on error threshold
	ht.updateHealthStatusLocked(h)
}

// updateHealthStatusLocked updates the IsHealthy flag based on current state.
// Caller must hold the write lock.
func (ht *HealthTracker) updateHealthStatusLocked(h *ProviderHealth) {
	now := time.Now()

	// If the last error is outside the window, reset error count
	if !h.LastError.IsZero() && now.Sub(h.LastError) > ht.window {
		h.ErrorCount = 0
		h.IsHealthy = true
		return
	}

	// Provider is unhealthy if error count >= threshold within the window
	h.IsHealthy = h.ErrorCount < ht.threshold
}

// IsHealthy checks if a provider is currently considered healthy.
func (ht *HealthTracker) IsHealthy(providerID string) bool {
	ht.mu.RLock()
	h, ok := ht.health[providerID]
	if !ok {
		ht.mu.RUnlock()
		return true // Unknown providers are considered healthy by default
	}

	// Check if errors have aged out without modifying state
	now := time.Now()
	if !h.LastError.IsZero() && now.Sub(h.LastError) > ht.window {
		ht.mu.RUnlock()
		// Errors have aged out, consider healthy
		return true
	}

	isHealthy := h.ErrorCount < ht.threshold
	ht.mu.RUnlock()
	return isHealthy
}

// GetHealth returns health info for a provider.
func (ht *HealthTracker) GetHealth(providerID string) *ProviderHealth {
	ht.mu.RLock()
	defer ht.mu.RUnlock()

	h, ok := ht.health[providerID]
	if !ok {
		return &ProviderHealth{
			ProviderID: providerID,
			IsHealthy:  true,
		}
	}

	// Return a copy to avoid race conditions
	now := time.Now()
	copy := &ProviderHealth{
		ProviderID:    h.ProviderID,
		ErrorCount:    h.ErrorCount,
		TotalRequests: h.TotalRequests,
		LastError:     h.LastError,
		LastSuccess:   h.LastSuccess,
	}

	// Recalculate health status for the copy
	if !h.LastError.IsZero() && now.Sub(h.LastError) > ht.window {
		copy.ErrorCount = 0
		copy.IsHealthy = true
	} else {
		copy.IsHealthy = h.ErrorCount < ht.threshold
	}

	return copy
}

// GetAllHealth returns health info for all tracked providers.
func (ht *HealthTracker) GetAllHealth() map[string]*ProviderHealth {
	ht.mu.RLock()
	defer ht.mu.RUnlock()

	result := make(map[string]*ProviderHealth, len(ht.health))
	now := time.Now()

	for id, h := range ht.health {
		copy := &ProviderHealth{
			ProviderID:    h.ProviderID,
			ErrorCount:    h.ErrorCount,
			TotalRequests: h.TotalRequests,
			LastError:     h.LastError,
			LastSuccess:   h.LastSuccess,
		}

		// Recalculate health status for the copy
		if !h.LastError.IsZero() && now.Sub(h.LastError) > ht.window {
			copy.ErrorCount = 0
			copy.IsHealthy = true
		} else {
			copy.IsHealthy = h.ErrorCount < ht.threshold
		}

		result[id] = copy
	}

	return result
}
