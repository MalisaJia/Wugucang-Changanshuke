package admin

import (
	"log/slog"
	"math"

	"github.com/gofiber/fiber/v2"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// AuditHandler handles audit log API endpoints.
type AuditHandler struct {
	repo   *postgres.AuditRepository
	logger *slog.Logger
}

// NewAuditHandler creates a new AuditHandler.
func NewAuditHandler(repo *postgres.AuditRepository, logger *slog.Logger) *AuditHandler {
	return &AuditHandler{
		repo:   repo,
		logger: logger,
	}
}

// AuditLogResponse represents the response for audit log listing.
type AuditLogResponse struct {
	Data       []*postgres.AuditLog `json:"data"`
	Pagination PaginationInfo       `json:"pagination"`
}

// PaginationInfo contains pagination metadata.
type PaginationInfo struct {
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

// List returns audit logs for the current tenant.
// GET /api/audit-logs
// Query params: page (default 1), per_page (default 20, max 100)
func (h *AuditHandler) List(c *fiber.Ctx) error {
	// Get tenant context
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("missing tenant context")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse pagination parameters
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}

	perPage := c.QueryInt("per_page", 20)
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	// Calculate offset
	offset := (page - 1) * perPage

	// Fetch audit logs from repository
	logs, total, err := h.repo.ListByTenantID(c.Context(), tc.TenantID, perPage, offset)
	if err != nil {
		h.logger.Error("failed to list audit logs",
			"error", err,
			"tenant_id", tc.TenantID,
		)
		e := apierr.InternalError("failed to retrieve audit logs")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Ensure logs is never nil in response
	if logs == nil {
		logs = []*postgres.AuditLog{}
	}

	// Calculate total pages
	totalPages := int(math.Ceil(float64(total) / float64(perPage)))
	if totalPages < 1 {
		totalPages = 1
	}

	response := AuditLogResponse{
		Data: logs,
		Pagination: PaginationInfo{
			Page:       page,
			PerPage:    perPage,
			Total:      total,
			TotalPages: totalPages,
		},
	}

	return c.JSON(response)
}
