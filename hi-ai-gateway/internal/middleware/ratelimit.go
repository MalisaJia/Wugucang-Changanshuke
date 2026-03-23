package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	apierr "github.com/hi-ai/gateway/internal/errors"
)

const (
	// rateLimitWindow is the sliding window size in seconds (1 minute)
	rateLimitWindow = 60
)

// RateLimitConfig holds the configuration for rate limiting.
type RateLimitConfig struct {
	Enabled    bool
	DefaultRPM int
}

// RateLimiter implements Redis-based sliding window rate limiting.
type RateLimiter struct {
	redis  *redis.Client
	logger *slog.Logger
	config RateLimitConfig
}

// NewRateLimiter creates a new rate limiter with the given Redis client and logger.
func NewRateLimiter(redisClient *redis.Client, logger *slog.Logger, cfg RateLimitConfig) *RateLimiter {
	return &RateLimiter{
		redis:  redisClient,
		logger: logger,
		config: cfg,
	}
}

// Middleware returns a Fiber middleware that enforces rate limits.
// It uses a sliding window algorithm with Redis for distributed rate limiting.
func (rl *RateLimiter) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip if rate limiting is disabled
		if !rl.config.Enabled {
			return c.Next()
		}

		// Get tenant context from auth middleware
		tc := GetTenantContext(c)
		if tc == nil {
			// No tenant context - allow through (auth middleware should have blocked)
			return c.Next()
		}

		// Determine the rate limit to apply
		// Priority: API key limit > tenant limit > default limit
		limit := rl.config.DefaultRPM
		if tc.RateLimitRPM > 0 {
			limit = tc.RateLimitRPM
		}

		// Skip rate limiting if limit is 0 or negative (unlimited)
		if limit <= 0 {
			return c.Next()
		}

		// Build the rate limit key
		key := fmt.Sprintf("ratelimit:%s:%s", tc.TenantID, tc.KeyID)

		// Check rate limit
		ctx := context.Background()
		allowed, current, resetIn, err := rl.checkRateLimit(ctx, key, limit)

		if err != nil {
			// Fail-open: if Redis is unavailable, allow the request
			rl.logger.Warn("rate limit check failed, allowing request (fail-open)",
				"error", err,
				"tenant_id", tc.TenantID,
				"key_id", tc.KeyID,
			)
			return c.Next()
		}

		// Calculate remaining requests
		remaining := limit - current
		if remaining < 0 {
			remaining = 0
		}

		// Set rate limit headers
		c.Set("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Set("X-RateLimit-Reset", strconv.FormatInt(resetIn, 10))

		if !allowed {
			// Rate limit exceeded
			c.Set("Retry-After", strconv.FormatInt(resetIn, 10))

			rl.logger.Info("rate limit exceeded",
				"tenant_id", tc.TenantID,
				"key_id", tc.KeyID,
				"limit", limit,
				"current", current,
				"retry_after", resetIn,
			)

			e := apierr.RateLimited(fmt.Sprintf("Rate limit exceeded. Try again in %d seconds", resetIn))
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}

		return c.Next()
	}
}

// checkRateLimit checks and increments the rate limit counter using sliding window.
// Returns: allowed, current count, seconds until reset, error
func (rl *RateLimiter) checkRateLimit(ctx context.Context, key string, limit int) (bool, int, int64, error) {
	if rl.redis == nil {
		return true, 0, 0, fmt.Errorf("redis client not available")
	}

	now := time.Now()
	windowStart := now.Unix() - rateLimitWindow
	currentWindow := fmt.Sprintf("%s:%d", key, now.Unix()/rateLimitWindow)

	// Use a Lua script for atomic check-and-increment
	// This implements a simple fixed window with automatic cleanup
	script := redis.NewScript(`
		local key = KEYS[1]
		local limit = tonumber(ARGV[1])
		local window = tonumber(ARGV[2])
		local now = tonumber(ARGV[3])
		
		-- Get current count
		local current = tonumber(redis.call('GET', key) or '0')
		
		-- Check if over limit
		if current >= limit then
			local ttl = redis.call('TTL', key)
			if ttl < 0 then ttl = window end
			return {0, current, ttl}
		end
		
		-- Increment and set expiry
		local newCount = redis.call('INCR', key)
		if newCount == 1 then
			redis.call('EXPIRE', key, window)
		end
		
		local ttl = redis.call('TTL', key)
		if ttl < 0 then ttl = window end
		
		return {1, newCount, ttl}
	`)

	result, err := script.Run(ctx, rl.redis, []string{currentWindow}, limit, rateLimitWindow, now.Unix()).Slice()
	if err != nil {
		// Fallback to simple GET/INCR if Lua script fails
		return rl.checkRateLimitSimple(ctx, currentWindow, limit)
	}

	if len(result) < 3 {
		return true, 0, int64(rateLimitWindow), nil
	}

	allowed := result[0].(int64) == 1
	current := int(result[1].(int64))
	resetIn := result[2].(int64)

	_ = windowStart // suppress unused variable warning

	return allowed, current, resetIn, nil
}

// checkRateLimitSimple is a fallback rate limit check without Lua scripts.
func (rl *RateLimiter) checkRateLimitSimple(ctx context.Context, key string, limit int) (bool, int, int64, error) {
	// Get current count
	countStr, err := rl.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		countStr = "0"
	} else if err != nil {
		return true, 0, 0, err
	}

	current, _ := strconv.Atoi(countStr)

	// Check if over limit
	if current >= limit {
		ttl, _ := rl.redis.TTL(ctx, key).Result()
		if ttl < 0 {
			ttl = time.Duration(rateLimitWindow) * time.Second
		}
		return false, current, int64(ttl.Seconds()), nil
	}

	// Increment
	newCount, err := rl.redis.Incr(ctx, key).Result()
	if err != nil {
		return true, 0, 0, err
	}

	// Set expiry if this is a new key
	if newCount == 1 {
		rl.redis.Expire(ctx, key, time.Duration(rateLimitWindow)*time.Second)
	}

	// Get TTL
	ttl, _ := rl.redis.TTL(ctx, key).Result()
	if ttl < 0 {
		ttl = time.Duration(rateLimitWindow) * time.Second
	}

	return true, int(newCount), int64(ttl.Seconds()), nil
}
