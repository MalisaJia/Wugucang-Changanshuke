package service

import (
	"context"
	"math"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"log/slog"
)

// RetryConfig 重试配置
type RetryConfig struct {
	MaxAttempts       int
	InitialBackoff    time.Duration
	MaxBackoff        time.Duration
	BackoffMultiplier float64
}

// DefaultRetryConfig 返回默认重试配置
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:       3,
		InitialBackoff:    200 * time.Millisecond,
		MaxBackoff:        5 * time.Second,
		BackoffMultiplier: 2.0,
	}
}

// Retryer 重试器
type Retryer struct {
	config RetryConfig
	logger *slog.Logger
}

// NewRetryer 创建重试器
func NewRetryer(config RetryConfig, logger *slog.Logger) *Retryer {
	if config.MaxAttempts <= 0 {
		config.MaxAttempts = 3
	}
	if config.InitialBackoff <= 0 {
		config.InitialBackoff = 200 * time.Millisecond
	}
	if config.MaxBackoff <= 0 {
		config.MaxBackoff = 5 * time.Second
	}
	if config.BackoffMultiplier <= 0 {
		config.BackoffMultiplier = 2.0
	}
	return &Retryer{config: config, logger: logger}
}

// IsRetryable 判断错误是否可重试
func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()

	// 超时错误 → 可重试
	if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "deadline exceeded") {
		return true
	}
	// 429 Too Many Requests → 可重试
	if strings.Contains(errStr, "429") || strings.Contains(errStr, "too many requests") || strings.Contains(errStr, "rate limit") {
		return true
	}
	// 5xx 错误 → 可重试
	if strings.Contains(errStr, "500") || strings.Contains(errStr, "502") || strings.Contains(errStr, "503") || strings.Contains(errStr, "504") {
		return true
	}
	// 连接错误 → 可重试
	if strings.Contains(errStr, "connection refused") || strings.Contains(errStr, "connection reset") || strings.Contains(errStr, "EOF") {
		return true
	}

	return false
}

// IsRetryableStatusCode 根据 HTTP 状态码判断
func IsRetryableStatusCode(code int) bool {
	return code == http.StatusTooManyRequests || code >= http.StatusInternalServerError
}

// CalculateBackoff 计算退避时间（含 jitter）
func (r *Retryer) CalculateBackoff(attempt int) time.Duration {
	backoff := float64(r.config.InitialBackoff) * math.Pow(r.config.BackoffMultiplier, float64(attempt))
	if backoff > float64(r.config.MaxBackoff) {
		backoff = float64(r.config.MaxBackoff)
	}
	// 添加 10-30% jitter 避免惊群效应
	jitter := backoff * (0.1 + rand.Float64()*0.2)
	return time.Duration(backoff + jitter)
}

// ShouldRetry 判断是否应继续重试
func (r *Retryer) ShouldRetry(attempt int, err error) bool {
	if attempt >= r.config.MaxAttempts-1 {
		return false
	}
	return IsRetryable(err)
}

// WaitForRetry 等待退避时间后重试
func (r *Retryer) WaitForRetry(ctx context.Context, attempt int) error {
	backoff := r.CalculateBackoff(attempt)
	r.logger.Info("retrying after backoff",
		"attempt", attempt+1,
		"max_attempts", r.config.MaxAttempts,
		"backoff", backoff.String(),
	)

	timer := time.NewTimer(backoff)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// GetMaxAttempts returns the maximum number of retry attempts
func (r *Retryer) GetMaxAttempts() int {
	return r.config.MaxAttempts
}
