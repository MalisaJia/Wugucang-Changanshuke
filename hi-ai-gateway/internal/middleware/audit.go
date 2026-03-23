package middleware

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// AuditLogger logs mutating API requests to the database.
type AuditLogger struct {
	repo   *postgres.AuditRepository
	logger *slog.Logger
}

// NewAuditLogger creates a new AuditLogger.
func NewAuditLogger(repo *postgres.AuditRepository, logger *slog.Logger) *AuditLogger {
	return &AuditLogger{
		repo:   repo,
		logger: logger,
	}
}

// Middleware returns a Fiber handler that logs mutating requests after they complete.
func (al *AuditLogger) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Process the request first
		err := c.Next()

		// Only log mutating methods with successful responses
		method := c.Method()
		if !isMutatingMethod(method) {
			return err
		}

		statusCode := c.Response().StatusCode()
		if statusCode < 200 || statusCode >= 300 {
			return err
		}

		// Get tenant context - skip if not available (e.g., public auth endpoints)
		tc := GetTenantContext(c)
		if tc == nil {
			return err
		}

		// Derive action and resource type from the request
		path := c.Path()
		action, resourceType := deriveAction(method, path)

		// Extract resource ID from URL params if available
		resourceID := c.Params("id")

		// Build sanitized request summary (no passwords/keys)
		summary := map[string]interface{}{
			"method":      method,
			"path":        path,
			"status_code": statusCode,
			"user_agent":  c.Get("User-Agent"),
		}

		// Get user ID (may be nil for API key auth without user)
		var userID *string
		if tc.UserID != "" {
			userID = &tc.UserID
		}

		// Insert audit log asynchronously to not block the response
		auditLog := &postgres.AuditLog{
			TenantID:       tc.TenantID,
			UserID:         userID,
			Action:         action,
			ResourceType:   resourceType,
			ResourceID:     resourceID,
			IPAddress:      c.IP(),
			RequestSummary: summary,
			CreatedAt:      time.Now().UTC(),
		}

		go func() {
			ctx := context.Background()
			if insertErr := al.repo.Insert(ctx, auditLog); insertErr != nil {
				al.logger.Error("failed to insert audit log",
					"error", insertErr,
					"tenant_id", auditLog.TenantID,
					"action", auditLog.Action,
				)
			}
		}()

		return err
	}
}

// isMutatingMethod returns true if the HTTP method is a mutating operation.
func isMutatingMethod(method string) bool {
	switch method {
	case fiber.MethodPost, fiber.MethodPut, fiber.MethodPatch, fiber.MethodDelete:
		return true
	default:
		return false
	}
}

// deriveAction determines the action and resource type from HTTP method and path.
func deriveAction(method, path string) (action, resourceType string) {
	// Normalize path by removing trailing slash and converting to lowercase
	path = strings.TrimSuffix(strings.ToLower(path), "/")

	// Map common API patterns to actions and resource types
	switch {
	// API Key management
	case strings.Contains(path, "/api/keys"):
		resourceType = "api_key"
		switch method {
		case fiber.MethodPost:
			action = "create"
		case fiber.MethodDelete:
			action = "revoke"
		case fiber.MethodPut, fiber.MethodPatch:
			action = "update"
		default:
			action = strings.ToLower(method)
		}

	// Tenant management
	case strings.Contains(path, "/api/tenant"):
		resourceType = "tenant"
		switch method {
		case fiber.MethodPost:
			action = "create"
		case fiber.MethodPut, fiber.MethodPatch:
			action = "update"
		case fiber.MethodDelete:
			action = "delete"
		default:
			action = strings.ToLower(method)
		}

	// User profile management
	case strings.Contains(path, "/api/profile/password"):
		resourceType = "user_profile"
		action = "change_password"

	case strings.Contains(path, "/api/profile"):
		resourceType = "user_profile"
		switch method {
		case fiber.MethodPut, fiber.MethodPatch:
			action = "update"
		default:
			action = strings.ToLower(method)
		}

	// Provider configuration
	case strings.Contains(path, "/api/providers"):
		resourceType = "provider_config"
		switch method {
		case fiber.MethodPost:
			action = "create"
		case fiber.MethodPut, fiber.MethodPatch:
			action = "update"
		case fiber.MethodDelete:
			action = "delete"
		default:
			action = strings.ToLower(method)
		}

	// Authentication endpoints
	case strings.Contains(path, "/api/auth/register"):
		resourceType = "user"
		action = "register"

	case strings.Contains(path, "/api/auth/login"):
		resourceType = "user"
		action = "login"

	// Chat completions (v1 API)
	case strings.Contains(path, "/v1/chat/completions"):
		resourceType = "chat_completion"
		action = "create"

	// Default fallback
	default:
		resourceType = "unknown"
		action = strings.ToLower(method)
	}

	return action, resourceType
}
