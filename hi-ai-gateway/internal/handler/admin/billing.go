package admin

import (
	"log/slog"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/hi-ai/gateway/internal/domain"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/payment"
	"github.com/hi-ai/gateway/internal/repository/postgres"
	"github.com/hi-ai/gateway/internal/service"
)

// BillingHandler handles billing-related endpoints.
type BillingHandler struct {
	billingSvc *service.BillingService
	providers  map[string]payment.PaymentProvider
	logger     *slog.Logger
	baseURL    string // Base URL for success/cancel redirects
}

// NewBillingHandler creates a new billing handler.
func NewBillingHandler(billingSvc *service.BillingService, providers map[string]payment.PaymentProvider, baseURL string, logger *slog.Logger) *BillingHandler {
	return &BillingHandler{
		billingSvc: billingSvc,
		providers:  providers,
		logger:     logger,
		baseURL:    baseURL,
	}
}

// BalanceResponse represents the balance response.
type BalanceResponse struct {
	AmountBalance  int64 `json:"amount_balance"`  // Current balance in cents
	TotalRecharged int64 `json:"total_recharged"` // Total recharged in cents
	TotalConsumed  int64 `json:"total_consumed"`  // Total consumed in cents
}

// GetBalance handles GET /api/billing/balance - Query current balance.
func (h *BillingHandler) GetBalance(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tenantID, err := uuid.Parse(tc.TenantID)
	if err != nil {
		e := apierr.BadRequest("invalid tenant ID")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	balance, err := h.billingSvc.GetBalance(c.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get balance", "error", err, "tenant_id", tc.TenantID)
		// If balance not found, return zero balance
		return c.JSON(BalanceResponse{
			AmountBalance:  0,
			TotalRecharged: 0,
			TotalConsumed:  0,
		})
	}

	return c.JSON(BalanceResponse{
		AmountBalance:  balance.AmountBalance,
		TotalRecharged: balance.TotalRecharged,
		TotalConsumed:  balance.TotalConsumed,
	})
}

// TransactionsResponse represents the paginated transactions response.
type TransactionsResponse struct {
	Transactions []domain.Transaction `json:"transactions"`
	Total        int                  `json:"total"`
	Page         int                  `json:"page"`
	PerPage      int                  `json:"per_page"`
}

// ListTransactions handles GET /api/billing/transactions - List transaction history.
func (h *BillingHandler) ListTransactions(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tenantID, err := uuid.Parse(tc.TenantID)
	if err != nil {
		e := apierr.BadRequest("invalid tenant ID")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse pagination params
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

	transactions, total, err := h.billingSvc.ListTransactions(c.Context(), tenantID, page, perPage)
	if err != nil {
		h.logger.Error("failed to list transactions", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("failed to list transactions")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Ensure non-nil slice
	if transactions == nil {
		transactions = []domain.Transaction{}
	}

	return c.JSON(TransactionsResponse{
		Transactions: transactions,
		Total:        total,
		Page:         page,
		PerPage:      perPage,
	})
}

// RechargeRequest represents the recharge request body.
type RechargeRequest struct {
	PackageID string `json:"package_id"`
	Method    string `json:"method"`
}

// RechargeResponse represents the recharge response.
type RechargeResponse struct {
	OrderNo     string `json:"order_no"`
	CheckoutURL string `json:"checkout_url,omitempty"` // For Stripe redirect
	QRCode      string `json:"qr_code,omitempty"`      // For Alipay/WeChat QR
	Method      string `json:"method"`
}

// CreateRecharge handles POST /api/billing/recharge - Create a recharge order.
func (h *BillingHandler) CreateRecharge(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tenantID, err := uuid.Parse(tc.TenantID)
	if err != nil {
		e := apierr.BadRequest("invalid tenant ID")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req RechargeRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate required fields
	if req.PackageID == "" {
		e := apierr.BadRequest("package_id is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}
	if req.Method == "" {
		e := apierr.BadRequest("method is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Check if payment provider is configured
	provider, exists := h.providers[req.Method]
	if !exists {
		e := apierr.BadRequest("payment method not supported: " + req.Method)
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Create payment order in database
	paymentOrder, err := h.billingSvc.CreatePaymentOrder(c.Context(), tenantID, req.Method, req.PackageID)
	if err != nil {
		h.logger.Error("failed to create payment order", "error", err, "tenant_id", tc.TenantID)
		e := apierr.BadRequest(err.Error())
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Find package for description
	var description string
	for _, pkg := range domain.RechargePackages {
		if pkg.ID == req.PackageID {
			description = pkg.Name
			break
		}
	}

	// Build success and cancel URLs
	successURL := h.baseURL + "/dashboard/billing?payment=success&order=" + paymentOrder.OrderNo
	cancelURL := h.baseURL + "/dashboard/billing?payment=cancelled&order=" + paymentOrder.OrderNo

	// Create checkout with payment provider
	checkoutURL, err := provider.CreateCheckout(
		paymentOrder.OrderNo,
		paymentOrder.AmountCents,
		paymentOrder.Currency,
		description,
		successURL,
		cancelURL,
	)
	if err != nil {
		h.logger.Error("failed to create checkout", "error", err, "order_no", paymentOrder.OrderNo, "method", req.Method)
		e := apierr.InternalError("failed to create payment session: " + err.Error())
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("recharge order created",
		"order_no", paymentOrder.OrderNo,
		"tenant_id", tc.TenantID,
		"method", req.Method,
		"amount_cents", paymentOrder.AmountCents,
	)

	// Return response based on method
	response := RechargeResponse{
		OrderNo: paymentOrder.OrderNo,
		Method:  req.Method,
	}

	// Stripe returns a checkout URL for redirect
	// Alipay/WeChat may return QR code content
	if req.Method == domain.PaymentMethodStripe {
		response.CheckoutURL = checkoutURL
	} else {
		response.QRCode = checkoutURL
	}

	return c.Status(fiber.StatusCreated).JSON(response)
}

// PackagesResponse represents the packages response.
type PackagesResponse struct {
	Packages []domain.RechargePackage `json:"packages"`
}

// ListPackages handles GET /api/billing/packages - List available recharge packages.
func (h *BillingHandler) ListPackages(c *fiber.Ctx) error {
	packages := h.billingSvc.GetRechargePackages()

	return c.JSON(PackagesResponse{
		Packages: packages,
	})
}

// UsageSummaryResponse represents the usage analytics summary response.
type UsageSummaryResponse struct {
	TodayTokensIn    int64               `json:"today_tokens_in"`
	TodayTokensOut   int64               `json:"today_tokens_out"`
	TodayTokensTotal int64               `json:"today_tokens_total"`
	TodayRequests    int64               `json:"today_requests"`
	TodayCostCents   int64               `json:"today_cost_cents"`  // Total cost today in cents
	MonthTokensIn    int64               `json:"month_tokens_in"`
	MonthTokensOut   int64               `json:"month_tokens_out"`
	MonthTokensTotal int64               `json:"month_tokens_total"`
	MonthRequests    int64               `json:"month_requests"`
	MonthCostCents   int64               `json:"month_cost_cents"`  // Total cost this month in cents
	DailyStats       []postgres.DailyStats `json:"daily_stats"`
	ModelStats       []postgres.ModelStats `json:"model_stats"`
}

// GetUsageSummary handles GET /api/billing/usage-summary - Get usage analytics summary.
func (h *BillingHandler) GetUsageSummary(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tenantID, err := uuid.Parse(tc.TenantID)
	if err != nil {
		e := apierr.BadRequest("invalid tenant ID")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse days parameter (default: 7)
	days, _ := strconv.Atoi(c.Query("days", "7"))
	if days < 1 {
		days = 7
	}
	if days > 90 {
		days = 90
	}

	// Calculate time boundaries
	now := time.Now()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	// Get today's stats
	todayIn, todayOut, err := h.billingSvc.GetUsageSummary(c.Context(), tenantID, startOfToday)
	if err != nil {
		h.logger.Error("failed to get today's usage summary", "error", err, "tenant_id", tc.TenantID)
		todayIn, todayOut = 0, 0
	}
	todayRequests, err := h.billingSvc.GetRequestCount(c.Context(), tenantID, startOfToday)
	if err != nil {
		h.logger.Error("failed to get today's request count", "error", err, "tenant_id", tc.TenantID)
		todayRequests = 0
	}
	todayCost, err := h.billingSvc.GetCostSummary(c.Context(), tenantID, startOfToday)
	if err != nil {
		h.logger.Error("failed to get today's cost summary", "error", err, "tenant_id", tc.TenantID)
		todayCost = 0
	}

	// Get month's stats
	monthIn, monthOut, err := h.billingSvc.GetUsageSummary(c.Context(), tenantID, startOfMonth)
	if err != nil {
		h.logger.Error("failed to get month's usage summary", "error", err, "tenant_id", tc.TenantID)
		monthIn, monthOut = 0, 0
	}
	monthRequests, err := h.billingSvc.GetRequestCount(c.Context(), tenantID, startOfMonth)
	if err != nil {
		h.logger.Error("failed to get month's request count", "error", err, "tenant_id", tc.TenantID)
		monthRequests = 0
	}
	monthCost, err := h.billingSvc.GetCostSummary(c.Context(), tenantID, startOfMonth)
	if err != nil {
		h.logger.Error("failed to get month's cost summary", "error", err, "tenant_id", tc.TenantID)
		monthCost = 0
	}

	// Get daily stats for the chart
	dailyStats, err := h.billingSvc.GetDailyStats(c.Context(), tenantID, days)
	if err != nil {
		h.logger.Error("failed to get daily stats", "error", err, "tenant_id", tc.TenantID)
		dailyStats = []postgres.DailyStats{}
	}

	// Get model stats
	modelStats, err := h.billingSvc.GetModelStats(c.Context(), tenantID, startOfMonth)
	if err != nil {
		h.logger.Error("failed to get model stats", "error", err, "tenant_id", tc.TenantID)
		modelStats = []postgres.ModelStats{}
	}

	return c.JSON(UsageSummaryResponse{
		TodayTokensIn:    todayIn,
		TodayTokensOut:   todayOut,
		TodayTokensTotal: todayIn + todayOut,
		TodayRequests:    todayRequests,
		TodayCostCents:   todayCost,
		MonthTokensIn:    monthIn,
		MonthTokensOut:   monthOut,
		MonthTokensTotal: monthIn + monthOut,
		MonthRequests:    monthRequests,
		MonthCostCents:   monthCost,
		DailyStats:       dailyStats,
		ModelStats:       modelStats,
	})
}

// UsageLogsResponse represents the paginated usage logs response.
type UsageLogsResponse struct {
	Logs    []domain.UsageLog `json:"logs"`
	Total   int               `json:"total"`
	Page    int               `json:"page"`
	PerPage int               `json:"per_page"`
}

// ListUsageLogs handles GET /api/billing/usage-logs - List usage logs.
func (h *BillingHandler) ListUsageLogs(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tenantID, err := uuid.Parse(tc.TenantID)
	if err != nil {
		e := apierr.BadRequest("invalid tenant ID")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Parse pagination params
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

	logs, total, err := h.billingSvc.ListUsageLogs(c.Context(), tenantID, page, perPage)
	if err != nil {
		h.logger.Error("failed to list usage logs", "error", err, "tenant_id", tc.TenantID)
		e := apierr.InternalError("failed to list usage logs")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Ensure non-nil slice
	if logs == nil {
		logs = []domain.UsageLog{}
	}

	return c.JSON(UsageLogsResponse{
		Logs:    logs,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}
