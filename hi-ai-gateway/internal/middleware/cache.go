package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	"github.com/hi-ai/gateway/internal/telemetry"
	"github.com/hi-ai/gateway/pkg/openai"
)

// CacheConfig holds configuration for the semantic cache.
type CacheConfig struct {
	Enabled bool
	TTL     time.Duration // default 5 minutes
	MaxSize int           // max response size to cache in bytes (default 100KB)
}

// SemanticCache provides Redis-based caching for chat completion requests.
type SemanticCache struct {
	redis  *redis.Client
	config CacheConfig
	logger *slog.Logger
}

// cacheKeyFields represents the fields used to generate a cache key.
// This ensures deterministic hashing by using explicit field ordering.
type cacheKeyFields struct {
	Model       string             `json:"model"`
	Messages    []normalizedMsg    `json:"messages"`
	Temperature *float64           `json:"temperature,omitempty"`
	TopP        *float64           `json:"top_p,omitempty"`
	MaxTokens   *int               `json:"max_tokens,omitempty"`
	Seed        *int               `json:"seed,omitempty"`
}

// normalizedMsg represents a normalized message for cache key generation.
type normalizedMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// NewSemanticCache creates a new SemanticCache instance.
func NewSemanticCache(redisClient *redis.Client, cfg CacheConfig, logger *slog.Logger) *SemanticCache {
	// Apply defaults
	if cfg.TTL == 0 {
		cfg.TTL = 5 * time.Minute
	}
	if cfg.MaxSize == 0 {
		cfg.MaxSize = 100 * 1024 // 100KB
	}

	return &SemanticCache{
		redis:  redisClient,
		config: cfg,
		logger: logger,
	}
}

// Middleware returns a Fiber handler for caching non-streaming chat completions.
func (sc *SemanticCache) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip if caching is disabled
		if !sc.config.Enabled {
			return c.Next()
		}

		// Skip if Redis client is not configured
		if sc.redis == nil {
			sc.logger.Warn("cache middleware: Redis client is nil, skipping cache")
			return c.Next()
		}

		// Only cache POST requests to chat completions
		if c.Method() != fiber.MethodPost {
			return c.Next()
		}

		// Parse the request body
		body := c.Body()
		if len(body) == 0 {
			return c.Next()
		}

		var req openai.ChatCompletionRequest
		if err := json.Unmarshal(body, &req); err != nil {
			// If we can't parse the request, skip caching and let the handler deal with it
			sc.logger.Debug("cache middleware: failed to parse request body", "error", err)
			return c.Next()
		}

		// Skip streaming requests - they cannot be cached
		if req.Stream {
			return c.Next()
		}

		// Generate cache key
		cacheKey, err := sc.generateCacheKey(&req)
		if err != nil {
			sc.logger.Warn("cache middleware: failed to generate cache key", "error", err)
			return c.Next()
		}

		// Get tenant ID for metrics (may be nil if auth hasn't run yet)
		tenantID := sc.getTenantID(c)

		// Try to get from cache
		ctx := context.Background()
		cached, err := sc.redis.Get(ctx, cacheKey).Bytes()
		if err == nil && len(cached) > 0 {
			// Cache HIT
			sc.logger.Debug("cache middleware: cache hit", "key", cacheKey)
			c.Set("X-Cache", "HIT")
			c.Set("Content-Type", "application/json")

			// Record cache hit metric
			telemetry.LLMCacheHits.WithLabelValues("semantic", tenantID).Inc()

			return c.Status(fiber.StatusOK).Send(cached)
		}

		if err != nil && err != redis.Nil {
			// Redis error - log and continue without cache (fail-open)
			sc.logger.Warn("cache middleware: Redis GET error", "error", err, "key", cacheKey)
		}

		// Cache MISS - set header and proceed
		c.Set("X-Cache", "MISS")

		// Call the next handler
		if err := c.Next(); err != nil {
			return err
		}

		// After handler completes, check if we should cache the response
		sc.cacheResponse(ctx, c, cacheKey, tenantID)

		return nil
	}
}

// generateCacheKey creates a deterministic cache key from the request.
func (sc *SemanticCache) generateCacheKey(req *openai.ChatCompletionRequest) (string, error) {
	// Normalize messages
	normalizedMsgs := make([]normalizedMsg, 0, len(req.Messages))
	for _, msg := range req.Messages {
		content := sc.normalizeContent(msg.Content)
		normalizedMsgs = append(normalizedMsgs, normalizedMsg{
			Role:    strings.TrimSpace(msg.Role),
			Content: content,
		})
	}

	// Create the key fields struct
	keyFields := cacheKeyFields{
		Model:       strings.TrimSpace(req.Model),
		Messages:    normalizedMsgs,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		MaxTokens:   req.MaxTokens,
		Seed:        req.Seed,
	}

	// Marshal to JSON for deterministic hashing
	// Note: Go's json.Marshal produces deterministic output for structs
	data, err := json.Marshal(keyFields)
	if err != nil {
		return "", err
	}

	// Generate SHA256 hash
	hash := sha256.Sum256(data)
	hashStr := hex.EncodeToString(hash[:])

	return "cache:chat:" + hashStr, nil
}

// normalizeContent converts message content to a normalized string.
// Content can be a string or an array of content parts.
func (sc *SemanticCache) normalizeContent(content interface{}) string {
	if content == nil {
		return ""
	}

	switch v := content.(type) {
	case string:
		return strings.TrimSpace(v)
	case []interface{}:
		// Handle multi-modal content (array of content parts)
		var parts []string
		for _, part := range v {
			if partMap, ok := part.(map[string]interface{}); ok {
				// Extract text content from content parts
				if text, ok := partMap["text"].(string); ok {
					parts = append(parts, strings.TrimSpace(text))
				}
			}
		}
		// Sort parts for deterministic ordering
		sort.Strings(parts)
		return strings.Join(parts, "|")
	default:
		// For other types, try to marshal to JSON
		data, err := json.Marshal(v)
		if err != nil {
			return ""
		}
		return string(data)
	}
}

// cacheResponse stores the response in Redis if it meets the criteria.
func (sc *SemanticCache) cacheResponse(ctx context.Context, c *fiber.Ctx, cacheKey, tenantID string) {
	// Only cache successful responses
	if c.Response().StatusCode() != fiber.StatusOK {
		return
	}

	// Get response body
	responseBody := c.Response().Body()
	if len(responseBody) == 0 {
		return
	}

	// Check size limit
	if len(responseBody) > sc.config.MaxSize {
		sc.logger.Debug("cache middleware: response too large to cache",
			"size", len(responseBody),
			"maxSize", sc.config.MaxSize,
			"key", cacheKey)
		return
	}

	// Store in Redis with TTL
	err := sc.redis.Set(ctx, cacheKey, responseBody, sc.config.TTL).Err()
	if err != nil {
		sc.logger.Warn("cache middleware: failed to store in cache", "error", err, "key", cacheKey)
		return
	}

	// Record cache miss metric (we're storing a new entry)
	telemetry.LLMCacheMisses.WithLabelValues(tenantID).Inc()

	sc.logger.Debug("cache middleware: cached response", "key", cacheKey, "size", len(responseBody))
}

// getTenantID extracts the tenant ID from the request context.
func (sc *SemanticCache) getTenantID(c *fiber.Ctx) string {
	tc := GetTenantContext(c)
	if tc != nil {
		return tc.TenantID
	}
	return "unknown"
}
