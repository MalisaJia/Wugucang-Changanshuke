package admin

import (
	"log/slog"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/hi-ai/gateway/internal/domain"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// PaymentsHandler handles payment administration endpoints.
type PaymentsHandler struct {
	billingRepo *postgres.BillingRepository
	logger      *slog.Logger
}

// NewPaymentsHandler creates a new PaymentsHandler.
func NewPaymentsHandler(billingRepo *postgres.BillingRepository, logger *slog.Logger) *PaymentsHandler {
	return &PaymentsHandler{
		billingRepo: billingRepo,
		logger:      logger,
	}
}

// requireAdmin checks if the user has admin or owner role.
func (h *PaymentsHandler) requireAdmin(c *fiber.Ctx) (*middleware.TenantContext, error) {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		return nil, apierr.Unauthorized("authentication required")
	}

	role := domain.Role(tc.Role)
	if !role.HasPermission(domain.RoleAdmin) {
		return nil, apierr.Forbidden("admin access required")
	}

	return tc, nil
}

// PaymentsListResponse represents the paginated transactions response.
type PaymentsListResponse struct {
	Transactions []domain.Transaction `json:"transactions"`
	Total        int                  `json:"total"`
	Page         int                  `json:"page"`
	PerPage      int                  `json:"per_page"`
}

// ListPayments handles GET /api/admin/payments - List all payment transactions.
func (h *PaymentsHandler) ListPayments(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse query params
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	statusFilter := c.Query("status", "")
	methodFilter := c.Query("method", "")

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	transactions, total, err := h.billingRepo.ListAllTransactions(c.Context(), page, perPage, statusFilter, methodFilter)
	if err != nil {
		h.logger.Error("failed to list transactions", "error", err)
		e := apierr.InternalError("failed to list transactions")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if transactions == nil {
		transactions = []domain.Transaction{}
	}

	return c.JSON(PaymentsListResponse{
		Transactions: transactions,
		Total:        total,
		Page:         page,
		PerPage:      perPage,
	})
}
