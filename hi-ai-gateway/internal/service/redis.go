package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/hi-ai/gateway/internal/config"
)

// RedisClient wraps a Redis client with health check functionality.
type RedisClient struct {
	client *redis.Client
	logger *slog.Logger
}

// NewRedisClient creates a new Redis client from the given configuration.
// It attempts to connect and ping Redis, but does not fail if Redis is unavailable.
// Instead, it logs a warning and returns a client that will attempt to reconnect.
func NewRedisClient(cfg config.RedisConfig, logger *slog.Logger) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
		MinIdleConns: 2,
	})

	rc := &RedisClient{
		client: client,
		logger: logger,
	}

	// Attempt to ping Redis, but don't fail if unavailable
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Warn("redis connection failed, rate limiting will fail-open",
			"error", err,
			"addr", cfg.Addr,
		)
	} else {
		logger.Info("redis connection established",
			"addr", cfg.Addr,
			"db", cfg.DB,
		)
	}

	return rc, nil
}

// Client returns the underlying Redis client.
func (r *RedisClient) Client() *redis.Client {
	return r.client
}

// HealthCheck performs a health check on the Redis connection.
func (r *RedisClient) HealthCheck(ctx context.Context) error {
	if r.client == nil {
		return fmt.Errorf("redis client not initialized")
	}
	return r.client.Ping(ctx).Err()
}

// Close closes the Redis connection.
func (r *RedisClient) Close() error {
	if r.client == nil {
		return nil
	}
	return r.client.Close()
}

// IsAvailable checks if Redis is currently reachable.
func (r *RedisClient) IsAvailable(ctx context.Context) bool {
	if r.client == nil {
		return false
	}
	return r.client.Ping(ctx).Err() == nil
}
