package middleware

import (
	"context"
	"encoding/json"
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
		// Capture request body before processing (for action resolution)
		var requestBody []byte
		if isMutatingMethod(c.Method()) {
			requestBody = c.Body()
		}

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

		// Resolve human-readable action_type and detail
		actionType, detail := resolveAction(method, path, requestBody)

		// Extract resource ID from URL params if available
		resourceID := c.Params("id")

		// Build sanitized request summary (no passwords/keys)
		summary := map[string]interface{}{
			"method":      method,
			"path":        path,
			"status_code": statusCode,
			"user_agent":  c.Get("User-Agent"),
			"action_type": actionType,
			"detail":      detail,
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

// resolveAction determines human-readable action_type and detail from HTTP method, path, and request body.
func resolveAction(method, path string, body []byte) (actionType, detail string) {
	// Normalize path for matching
	normalizedPath := strings.ToLower(path)

	switch {
	// Chat completions - extract model from request body
	case method == "POST" && strings.Contains(normalizedPath, "/v1/chat/completions"):
		model := extractModelFromBody(body)
		return "chat_completion", "model: " + model

	// API Key management
	case method == "POST" && (strings.HasSuffix(normalizedPath, "/keys") || strings.HasSuffix(normalizedPath, "/api/keys")):
		return "api_key_create", "创建了新的 API Key"
	case method == "DELETE" && strings.Contains(normalizedPath, "/keys/"):
		return "api_key_revoke", "撤销了 API Key"

	// Provider configuration
	case method == "POST" && strings.Contains(normalizedPath, "/providers"):
		provider := extractProviderFromBody(body)
		return "provider_create", "provider: " + provider
	case method == "PUT" && strings.Contains(normalizedPath, "/providers/"):
		provider := extractProviderFromPath(normalizedPath)
		return "provider_update", "provider: " + provider
	case method == "DELETE" && strings.Contains(normalizedPath, "/providers/"):
		provider := extractProviderFromPath(normalizedPath)
		return "provider_delete", "provider: " + provider

	// Authentication endpoints
	case method == "POST" && strings.HasSuffix(normalizedPath, "/login"):
		return "user_login", "用户登录"
	case method == "POST" && strings.HasSuffix(normalizedPath, "/register"):
		return "user_register", "用户注册"

	// Billing
	case method == "POST" && strings.Contains(normalizedPath, "/recharge"):
		return "billing_recharge", "账户充值"
	case method == "POST" && strings.Contains(normalizedPath, "/billing"):
		return "billing_operation", ""

	// Profile management
	case method == "PUT" && strings.Contains(normalizedPath, "/profile/password"):
		return "password_change", "修改了密码"
	case method == "PUT" && strings.Contains(normalizedPath, "/profile"):
		return "profile_update", "更新了个人资料"

	// Tenant management
	case method == "POST" && strings.Contains(normalizedPath, "/tenant"):
		return "tenant_create", "创建了租户"
	case method == "PUT" && strings.Contains(normalizedPath, "/tenant"):
		return "tenant_update", "更新了租户设置"

	// Default fallback - use HTTP method and path
	default:
		return strings.ToLower(method), normalizedPath
	}
}

// extractModelFromBody extracts the model name from a chat completion request body.
func extractModelFromBody(body []byte) string {
	if len(body) == 0 {
		return "unknown"
	}
	var req struct {
		Model string `json:"model"`
	}
	if json.Unmarshal(body, &req) == nil && req.Model != "" {
		return req.Model
	}
	return "unknown"
}

// extractProviderFromBody extracts the provider name from a request body.
func extractProviderFromBody(body []byte) string {
	if len(body) == 0 {
		return "unknown"
	}
	var req struct {
		Provider string `json:"provider"`
		Name     string `json:"name"`
	}
	if json.Unmarshal(body, &req) == nil {
		if req.Provider != "" {
			return req.Provider
		}
		if req.Name != "" {
			return req.Name
		}
	}
	return "unknown"
}

// extractProviderFromPath extracts the provider ID from a URL path like /api/providers/{id}
func extractProviderFromPath(path string) string {
	// Split path and find the segment after "providers"
	segments := strings.Split(path, "/")
	for i, seg := range segments {
		if seg == "providers" && i+1 < len(segments) {
			return segments[i+1]
		}
	}
	return "unknown"
}
