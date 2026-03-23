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

// ManagementHandler handles admin management endpoints for global user and billing operations.
type ManagementHandler struct {
	userRepo    *postgres.UserRepository
	billingRepo *postgres.BillingRepository
	logger      *slog.Logger
}

// NewManagementHandler creates a new ManagementHandler.
func NewManagementHandler(userRepo *postgres.UserRepository, billingRepo *postgres.BillingRepository, logger *slog.Logger) *ManagementHandler {
	return &ManagementHandler{
		userRepo:    userRepo,
		billingRepo: billingRepo,
		logger:      logger,
	}
}

// requireAdmin checks if the user has admin or owner role.
func (h *ManagementHandler) requireAdmin(c *fiber.Ctx) (*middleware.TenantContext, error) {
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

// =====================
// User Management APIs
// =====================

// AdminUsersResponse represents the paginated users response.
type AdminUsersResponse struct {
	Users   []postgres.AdminUser `json:"users"`
	Total   int                  `json:"total"`
	Page    int                  `json:"page"`
	PerPage int                  `json:"per_page"`
}

// ListUsers handles GET /api/admin/users - List all users across tenants.
func (h *ManagementHandler) ListUsers(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse query params
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	emailSearch := c.Query("search", "")

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	users, total, err := h.userRepo.ListAllUsers(c.Context(), page, perPage, emailSearch)
	if err != nil {
		h.logger.Error("failed to list users", "error", err)
		e := apierr.InternalError("failed to list users")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if users == nil {
		users = []postgres.AdminUser{}
	}

	return c.JSON(AdminUsersResponse{
		Users:   users,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}

// =====================
// Balance Management APIs
// =====================

// UserBalanceResponse represents a user's balance information.
type UserBalanceResponse struct {
	TenantID       string `json:"tenant_id"`
	TokenBalance   int64  `json:"token_balance"`
	TotalRecharged int64  `json:"total_recharged"`
	TotalConsumed  int64  `json:"total_consumed"`
}

// GetUserBalance handles GET /api/admin/users/:id/balance - Get user balance by tenant ID.
func (h *ManagementHandler) GetUserBalance(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tenantID := c.Params("id")
	if tenantID == "" {
		e := apierr.BadRequest("tenant ID is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	balance, err := h.billingRepo.GetBalanceByTenantID(c.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get balance", "error", err, "tenant_id", tenantID)
		// Return zero balance if not found
		return c.JSON(UserBalanceResponse{
			TenantID:       tenantID,
			TokenBalance:   0,
			TotalRecharged: 0,
			TotalConsumed:  0,
		})
	}

	return c.JSON(UserBalanceResponse{
		TenantID:       tenantID,
		TokenBalance:   balance.TokenBalance,
		TotalRecharged: balance.TotalRecharged,
		TotalConsumed:  balance.TotalConsumed,
	})
}

// AdjustBalanceRequest represents the request body for balance adjustment.
type AdjustBalanceRequest struct {
	Adjustment int64  `json:"adjustment"`
	Reason     string `json:"reason"`
}

// AdjustUserBalance handles PUT /api/admin/users/:id/balance - Adjust user balance.
func (h *ManagementHandler) AdjustUserBalance(c *fiber.Ctx) error {
	tc, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tenantID := c.Params("id")
	if tenantID == "" {
		e := apierr.BadRequest("tenant ID is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req AdjustBalanceRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if req.Adjustment == 0 {
		e := apierr.BadRequest("adjustment cannot be zero")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if req.Reason == "" {
		e := apierr.BadRequest("reason is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Append admin info to reason
	reason := req.Reason + " (by admin: " + tc.Email + ")"

	if err := h.billingRepo.AdjustBalanceByTenantID(c.Context(), tenantID, req.Adjustment, reason); err != nil {
		h.logger.Error("failed to adjust balance", "error", err, "tenant_id", tenantID)
		e := apierr.InternalError("failed to adjust balance")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("balance adjusted by admin",
		"tenant_id", tenantID,
		"adjustment", req.Adjustment,
		"reason", reason,
		"admin_id", tc.UserID,
	)

	return c.JSON(fiber.Map{"success": true, "message": "Balance adjusted successfully"})
}

// =====================
// Refund APIs
// =====================

// RefundTransactionsResponse represents the paginated refund transactions response.
type RefundTransactionsResponse struct {
	Transactions []domain.Transaction `json:"transactions"`
	Total        int                  `json:"total"`
	Page         int                  `json:"page"`
	PerPage      int                  `json:"per_page"`
}

// ListRefundRequests handles GET /api/admin/refund-requests - List refund/adjustment transactions.
func (h *ManagementHandler) ListRefundRequests(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	transactions, total, err := h.billingRepo.ListRefundTransactions(c.Context(), page, perPage)
	if err != nil {
		h.logger.Error("failed to list refund transactions", "error", err)
		e := apierr.InternalError("failed to list refunds")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if transactions == nil {
		transactions = []domain.Transaction{}
	}

	return c.JSON(RefundTransactionsResponse{
		Transactions: transactions,
		Total:        total,
		Page:         page,
		PerPage:      perPage,
	})
}

// ProcessRefundRequest represents the request body for processing a refund.
type ProcessRefundRequest struct {
	UserID string `json:"user_id"` // This is actually tenant_id
	Amount int64  `json:"amount"`
	Reason string `json:"reason"`
}

// ProcessRefund handles POST /api/admin/refund - Process a refund for a user.
func (h *ManagementHandler) ProcessRefund(c *fiber.Ctx) error {
	tc, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req ProcessRefundRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if req.UserID == "" {
		e := apierr.BadRequest("user_id (tenant_id) is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if req.Amount <= 0 {
		e := apierr.BadRequest("refund amount must be positive")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if req.Reason == "" {
		e := apierr.BadRequest("reason is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Append admin info to reason
	reason := req.Reason + " (refund by admin: " + tc.Email + ")"

	if err := h.billingRepo.ProcessRefund(c.Context(), req.UserID, req.Amount, reason); err != nil {
		h.logger.Error("failed to process refund", "error", err, "tenant_id", req.UserID)
		e := apierr.InternalError("failed to process refund")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("refund processed by admin",
		"tenant_id", req.UserID,
		"amount", req.Amount,
		"reason", reason,
		"admin_id", tc.UserID,
	)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "message": "Refund processed successfully"})
}

// =====================
// Statistics APIs
// =====================

// AdminStatsResponse represents the system statistics response.
type AdminStatsResponse struct {
	TotalUsers       int64                `json:"total_users"`
	TotalRevenue     int64                `json:"total_revenue"`
	TotalRequests    int64                `json:"total_requests"`
	ActiveUsersToday int64                `json:"active_users_today"`
	RecentUsers      []postgres.AdminUser `json:"recent_users"`
	RecentTx         []domain.Transaction `json:"recent_transactions"`
}

// GetStats handles GET /api/admin/stats - Get system-level statistics.
func (h *ManagementHandler) GetStats(c *fiber.Ctx) error {
	_, err := h.requireAdmin(c)
	if err != nil {
		e := err.(*apierr.APIError)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	ctx := c.Context()

	// Get total users
	totalUsers, err := h.userRepo.CountTotalUsers(ctx)
	if err != nil {
		h.logger.Error("failed to count users", "error", err)
		totalUsers = 0
	}

	// Get total revenue
	totalRevenue, err := h.billingRepo.GetTotalRevenue(ctx)
	if err != nil {
		h.logger.Error("failed to get total revenue", "error", err)
		totalRevenue = 0
	}

	// Get total requests today
	totalRequests, err := h.billingRepo.GetTotalRequestsToday(ctx)
	if err != nil {
		h.logger.Error("failed to get total requests", "error", err)
		totalRequests = 0
	}

	// Get active users today
	activeUsersToday, err := h.userRepo.CountActiveUsersToday(ctx)
	if err != nil {
		h.logger.Error("failed to count active users", "error", err)
		activeUsersToday = 0
	}

	// Get recent users (last 10)
	recentUsers, err := h.userRepo.GetRecentUsers(ctx, 10)
	if err != nil {
		h.logger.Error("failed to get recent users", "error", err)
		recentUsers = []postgres.AdminUser{}
	}

	// Get recent transactions (last 10)
	recentTx, err := h.billingRepo.ListRecentTransactions(ctx, 10)
	if err != nil {
		h.logger.Error("failed to get recent transactions", "error", err)
		recentTx = []domain.Transaction{}
	}

	return c.JSON(AdminStatsResponse{
		TotalUsers:       totalUsers,
		TotalRevenue:     totalRevenue,
		TotalRequests:    totalRequests,
		ActiveUsersToday: activeUsersToday,
		RecentUsers:      recentUsers,
		RecentTx:         recentTx,
	})
}
