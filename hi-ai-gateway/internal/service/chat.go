package service

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/hi-ai/gateway/internal/adapter"
	"github.com/hi-ai/gateway/internal/domain"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/router"
	"github.com/hi-ai/gateway/internal/telemetry"
	"github.com/hi-ai/gateway/pkg/openai"
)

// ChatService orchestrates the chat completion pipeline.
type ChatService struct {
	registry      *adapter.Registry
	logger        *slog.Logger
	healthTracker *HealthTracker
	routingMode   domain.RoutingMode
	billingSvc    *BillingService
	retryer       *Retryer
	breakerPool   *middleware.BreakerPool
}

// NewChatService creates a new chat service.
func NewChatService(registry *adapter.Registry, logger *slog.Logger, healthTracker *HealthTracker, routingMode domain.RoutingMode, billingSvc *BillingService, retryer *Retryer, breakerPool *middleware.BreakerPool) *ChatService {
	if routingMode == "" {
		routingMode = domain.RoutingModeSingle // Default for backward compatibility
	}
	return &ChatService{
		registry:      registry,
		logger:        logger,
		healthTracker: healthTracker,
		routingMode:   routingMode,
		billingSvc:    billingSvc,
		retryer:       retryer,
		breakerPool:   breakerPool,
	}
}

// Complete executes the full chat completion pipeline.
func (s *ChatService) Complete(ctx context.Context, tc *middleware.TenantContext, req *openai.ChatCompletionRequest) (*openai.ChatCompletionResponse, error) {
	start := time.Now()

	// Calculate content length for conditional routing
	contentLength := calculateContentLength(req.Messages)

	// Resolve routing targets
	targets := s.resolveTargets(req.Model, contentLength)
	if len(targets) == 0 {
		return nil, apierr.New(apierr.CodeModelNotFound, fmt.Sprintf("model %q not found or no provider configured", req.Model))
	}

	// Separate healthy and unhealthy targets
	var healthyTargets, unhealthyTargets []domain.RoutingTarget
	for _, target := range targets {
		if s.healthTracker != nil && !s.healthTracker.IsHealthy(target.ProviderID) {
			unhealthyTargets = append(unhealthyTargets, target)
		} else {
			healthyTargets = append(healthyTargets, target)
		}
	}

	// Try healthy targets first, then unhealthy ones as last resort
	orderedTargets := append(healthyTargets, unhealthyTargets...)

	// Try each target in order (single mode: just one, fallback: multiple)
	var lastErr error
	for _, target := range orderedTargets {
		provider, ok := s.registry.Get(target.ProviderID)
		if !ok {
			s.logger.Warn("provider not found in registry", "provider", target.ProviderID)
			continue
		}

		// Check circuit breaker state - skip if open
		if s.breakerPool != nil && !s.breakerPool.IsAvailable(target.ProviderID, target.ModelID) {
			s.logger.Warn("circuit breaker open, skipping provider", "provider", target.ProviderID, "model", target.ModelID)
			continue
		}

		// Set the model to the target's model ID
		reqCopy := *req
		if target.ModelID != "" {
			reqCopy.Model = target.ModelID
		}

		// Retry loop for this provider
		maxAttempts := 1
		if s.retryer != nil {
			maxAttempts = s.retryer.GetMaxAttempts()
		}

		var resp *openai.ChatCompletionResponse
		var err error

		for attempt := 0; attempt < maxAttempts; attempt++ {
			if attempt > 0 {
				telemetry.RetriesTotal.WithLabelValues(target.ProviderID, target.ModelID, strconv.Itoa(attempt)).Inc()
			}

			// Execute through circuit breaker if available
			if s.breakerPool != nil {
				result, cbErr := s.breakerPool.Execute(target.ProviderID, target.ModelID, func() (interface{}, error) {
					return provider.ChatCompletion(ctx, &reqCopy)
				})
				if cbErr != nil {
					err = cbErr
					resp = nil
				} else {
					resp = result.(*openai.ChatCompletionResponse)
					err = nil
				}
			} else {
				resp, err = provider.ChatCompletion(ctx, &reqCopy)
			}

			if err == nil {
				// Success
				break
			}

			lastErr = err
			s.logger.Warn("provider call failed", "provider", target.ProviderID, "model", target.ModelID, "attempt", attempt+1, "error", err)

			// Check if we should retry
			if s.retryer != nil && s.retryer.ShouldRetry(attempt, err) {
				if waitErr := s.retryer.WaitForRetry(ctx, attempt); waitErr != nil {
					// Context cancelled, don't retry
					break
				}
				continue
			}

			// Not retryable or max attempts reached
			break
		}

		if err != nil {
			telemetry.LLMProviderErrors.WithLabelValues(target.ProviderID, "request_failed").Inc()
			// Record error for health tracking
			if s.healthTracker != nil {
				s.healthTracker.RecordError(target.ProviderID)
			}
			continue
		}

		// Record success for health tracking
		if s.healthTracker != nil {
			s.healthTracker.RecordSuccess(target.ProviderID)
		}

		// Record metrics
		duration := time.Since(start).Seconds()
		promptTokens := 0
		completionTokens := 0
		if resp.Usage != nil {
			promptTokens = resp.Usage.PromptTokens
			completionTokens = resp.Usage.CompletionTokens
		}
		telemetry.RecordRequest(target.ProviderID, target.ModelID, "success", tc.TenantID, duration, promptTokens, completionTokens)

		// Record usage and deduct balance asynchronously (don't block the response)
		go s.recordUsageAndDeduct(tc, req.Model, promptTokens, completionTokens, int(time.Since(start).Milliseconds()))

		return resp, nil
	}

	return nil, apierr.ProviderError("", fmt.Sprintf("all providers failed: %v", lastErr))
}

// CompleteStream executes the streaming chat completion pipeline.
// It returns a channel for streaming events and a callback to record usage after streaming completes.
func (s *ChatService) CompleteStream(ctx context.Context, tc *middleware.TenantContext, req *openai.ChatCompletionRequest) (<-chan adapter.StreamEvent, func(promptTokens, completionTokens int, latencyMs int), error) {
	// Calculate content length for conditional routing
	contentLength := calculateContentLength(req.Messages)

	targets := s.resolveTargets(req.Model, contentLength)
	if len(targets) == 0 {
		return nil, nil, apierr.New(apierr.CodeModelNotFound, fmt.Sprintf("model %q not found", req.Model))
	}

	// Separate healthy and unhealthy targets
	var healthyTargets, unhealthyTargets []domain.RoutingTarget
	for _, target := range targets {
		if s.healthTracker != nil && !s.healthTracker.IsHealthy(target.ProviderID) {
			unhealthyTargets = append(unhealthyTargets, target)
		} else {
			healthyTargets = append(healthyTargets, target)
		}
	}

	// Try healthy targets first, then unhealthy ones as last resort
	orderedTargets := append(healthyTargets, unhealthyTargets...)

	var lastErr error
	for _, target := range orderedTargets {
		provider, ok := s.registry.Get(target.ProviderID)
		if !ok {
			continue
		}

		// Check circuit breaker state - skip if open
		if s.breakerPool != nil && !s.breakerPool.IsAvailable(target.ProviderID, target.ModelID) {
			s.logger.Warn("circuit breaker open, skipping provider for stream", "provider", target.ProviderID, "model", target.ModelID)
			continue
		}

		reqCopy := *req
		reqCopy.Stream = true
		if target.ModelID != "" {
			reqCopy.Model = target.ModelID
		}

		// Retry loop for this provider (streaming)
		maxAttempts := 1
		if s.retryer != nil {
			maxAttempts = s.retryer.GetMaxAttempts()
		}

		var ch <-chan adapter.StreamEvent
		var err error

		for attempt := 0; attempt < maxAttempts; attempt++ {
			if attempt > 0 {
				telemetry.RetriesTotal.WithLabelValues(target.ProviderID, target.ModelID, strconv.Itoa(attempt)).Inc()
			}

			// Execute through circuit breaker if available
			if s.breakerPool != nil {
				result, cbErr := s.breakerPool.Execute(target.ProviderID, target.ModelID, func() (interface{}, error) {
					return provider.ChatCompletionStream(ctx, &reqCopy)
				})
				if cbErr != nil {
					err = cbErr
					ch = nil
				} else {
					ch = result.(<-chan adapter.StreamEvent)
					err = nil
				}
			} else {
				ch, err = provider.ChatCompletionStream(ctx, &reqCopy)
			}

			if err == nil {
				// Success
				break
			}

			lastErr = err
			s.logger.Warn("provider stream failed", "provider", target.ProviderID, "attempt", attempt+1, "error", err)

			// Check if we should retry
			if s.retryer != nil && s.retryer.ShouldRetry(attempt, err) {
				if waitErr := s.retryer.WaitForRetry(ctx, attempt); waitErr != nil {
					// Context cancelled, don't retry
					break
				}
				continue
			}

			// Not retryable or max attempts reached
			break
		}

		if err != nil {
			// Record error for health tracking
			if s.healthTracker != nil {
				s.healthTracker.RecordError(target.ProviderID)
			}
			continue
		}

		// Record success for health tracking (stream opened successfully)
		if s.healthTracker != nil {
			s.healthTracker.RecordSuccess(target.ProviderID)
		}

		telemetry.LLMActiveStreams.Inc()

		// Return a callback function for recording usage after streaming completes
		usageCallback := func(promptTokens, completionTokens int, latencyMs int) {
			go s.recordUsageAndDeduct(tc, req.Model, promptTokens, completionTokens, latencyMs)
		}

		return ch, usageCallback, nil
	}

	return nil, nil, apierr.ProviderError("", fmt.Sprintf("all providers failed for streaming: %v", lastErr))
}

// resolveTargets finds the routing targets for a given model.
// Uses the configured routing mode and the router infrastructure.
// Only providers that support the requested model are included.
func (s *ChatService) resolveTargets(model string, contentLength int) []domain.RoutingTarget {
	// Get all registered providers
	providers := s.registry.ListProviders()
	if len(providers) == 0 {
		return nil
	}

	// Filter providers that support the requested model
	var targets []domain.RoutingTarget
	for _, p := range providers {
		if p.SupportsModel(model) {
			targets = append(targets, domain.RoutingTarget{
				ProviderID: p.ID(),
				ModelID:    model,
				Weight:     1,
			})
			s.logger.Debug("provider supports model", "provider", p.ID(), "model", model)
		}
	}

	// If no provider explicitly supports this model, fall back to providers with empty models list
	if len(targets) == 0 {
		for _, p := range providers {
			if p.SupportsAllModels() {
				targets = append(targets, domain.RoutingTarget{
					ProviderID: p.ID(),
					ModelID:    model,
					Weight:     1,
				})
				s.logger.Debug("fallback to provider with no model restrictions", "provider", p.ID(), "model", model)
			}
		}
	}

	if len(targets) == 0 {
		s.logger.Warn("no provider found for model", "model", model)
		return nil
	}

	// Log routing decision
	providerIDs := make([]string, len(targets))
	for i, t := range targets {
		providerIDs[i] = t.ProviderID
	}
	s.logger.Info("routing model to providers", "model", model, "providers", providerIDs)

	// Create routing rule with the targets
	rule := &domain.RoutingRule{
		Mode:    s.routingMode,
		Targets: targets,
	}

	// Create the appropriate router based on routing mode
	r := router.NewRouter(s.routingMode, rule)

	// Create routing request
	routingReq := &domain.RoutingRequest{
		ModelID:       model,
		ContentLength: contentLength,
	}

	// Get ordered targets from the router
	orderedTargets, err := r.Route(context.Background(), routingReq)
	if err != nil {
		s.logger.Warn("routing failed, using fallback", "error", err)
		// Fallback to first provider
		if len(targets) > 0 {
			return targets[:1]
		}
		return nil
	}

	return orderedTargets
}

// DefaultRouter creates a simple default router for Phase 1.
func DefaultRouter(targets []domain.RoutingTarget) router.Router {
	rule := &domain.RoutingRule{
		Mode:    domain.RoutingModeSingle,
		Targets: targets,
	}
	return router.NewRouter(domain.RoutingModeSingle, rule)
}

// recordUsageAndDeduct records usage to the database and deducts tokens from balance.
// This is called asynchronously to not block API responses.
func (s *ChatService) recordUsageAndDeduct(tc *middleware.TenantContext, model string, promptTokens, completionTokens int, latencyMs int) {
	if s.billingSvc == nil {
		s.logger.Warn("billing service not configured, skipping usage tracking")
		return
	}

	// Parse tenant ID
	tenantID, err := uuid.Parse(tc.TenantID)
	if err != nil {
		s.logger.Error("invalid tenant ID for usage tracking", "tenant_id", tc.TenantID, "error", err)
		return
	}

	// Parse API key ID (may be empty for JWT auth)
	var keyID uuid.UUID
	if tc.KeyID != "" {
		keyID, _ = uuid.Parse(tc.KeyID)
	}

	// Use background context since the request context may be cancelled
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Deduct balance with detailed usage
	err = s.billingSvc.DeductWithDetails(ctx, tenantID, promptTokens, completionTokens, model, keyID, latencyMs)
	if err != nil {
		// Log the error but don't fail - we've already sent the response
		// In a production system, this should be handled with a retry queue
		s.logger.Error("failed to deduct balance",
			"tenant_id", tc.TenantID,
			"model", model,
			"prompt_tokens", promptTokens,
			"completion_tokens", completionTokens,
			"error", err,
		)
	} else {
		s.logger.Info("usage recorded and balance deducted",
			"tenant_id", tc.TenantID,
			"model", model,
			"prompt_tokens", promptTokens,
			"completion_tokens", completionTokens,
		)
	}
}

// EstimateTokens estimates the token count from text content.
// Uses a rough approximation: 1 token ≈ 4 chars for English, ≈ 2 chars for Chinese.
func EstimateTokens(text string) int {
	if text == "" {
		return 0
	}

	// Count Chinese characters (CJK Unified Ideographs)
	chineseCount := 0
	otherCount := 0

	for _, r := range text {
		if r >= 0x4E00 && r <= 0x9FFF {
			chineseCount++
		} else {
			otherCount++
		}
	}

	// Estimate tokens: Chinese chars ≈ 0.5 tokens each, other chars ≈ 0.25 tokens each
	chineseTokens := (chineseCount + 1) / 2 // Round up
	otherTokens := (otherCount + 3) / 4     // Round up

	return chineseTokens + otherTokens
}

// EstimateTokensFromMessages estimates tokens from a slice of messages.
func EstimateTokensFromMessages(messages []openai.Message) int {
	total := 0
	for _, msg := range messages {
		// Add overhead for message structure (~4 tokens per message)
		total += 4

		// Extract content
		switch content := msg.Content.(type) {
		case string:
			total += EstimateTokens(content)
		case []interface{}:
			// Handle multimodal content (text parts)
			for _, part := range content {
				if partMap, ok := part.(map[string]interface{}); ok {
					if text, ok := partMap["text"].(string); ok {
						total += EstimateTokens(text)
					}
				}
			}
		}

		// Add role tokens
		total += EstimateTokens(msg.Role)
	}

	return total
}

// CheckBalance checks if the tenant has sufficient balance before processing.
// This can be called before making expensive API calls.
func (s *ChatService) CheckBalance(ctx context.Context, tenantID string) error {
	if s.billingSvc == nil {
		return nil // No billing service, allow request
	}

	tid, err := uuid.Parse(tenantID)
	if err != nil {
		return apierr.BadRequest("invalid tenant ID")
	}

	balance, err := s.billingSvc.GetBalance(ctx, tid)
	if err != nil {
		// If no balance record exists, this might be a new user
		// Let EnsureBalance handle it during registration
		if strings.Contains(err.Error(), "not found") {
			return apierr.ErrInsufficientBalance
		}
		s.logger.Error("failed to check balance", "tenant_id", tenantID, "error", err)
		return nil // Fail-open on errors
	}

	if balance.AmountBalance <= 0 {
		return apierr.ErrInsufficientBalance
	}

	return nil
}

// GetBalance returns the current balance for a tenant.
func (s *ChatService) GetBalance(ctx context.Context, tenantID string) (*domain.Balance, error) {
	if s.billingSvc == nil {
		return nil, fmt.Errorf("billing service not configured")
	}

	tid, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, apierr.BadRequest("invalid tenant ID")
	}

	return s.billingSvc.GetBalance(ctx, tid)
}

// isChineseRune checks if a rune is a Chinese character.
func isChineseRune(r rune) bool {
	// CJK Unified Ideographs range
	return r >= 0x4E00 && r <= 0x9FFF
}

// GetRuneCount returns the rune count in a string.
func GetRuneCount(s string) int {
	return utf8.RuneCountInString(s)
}

// calculateContentLength calculates the total character length of all messages.
// Used for conditional routing based on content size.
func calculateContentLength(messages []openai.Message) int {
	totalLength := 0
	for _, msg := range messages {
		switch content := msg.Content.(type) {
		case string:
			totalLength += len(content)
		case []interface{}:
			// Handle multimodal content (extract text parts)
			for _, part := range content {
				if partMap, ok := part.(map[string]interface{}); ok {
					if text, ok := partMap["text"].(string); ok {
						totalLength += len(text)
					}
				}
			}
		}
	}
	return totalLength
}
