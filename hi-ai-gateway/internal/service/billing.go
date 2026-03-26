package service

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"

	"github.com/hi-ai/gateway/internal/domain"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// BillingService handles billing-related business logic.
type BillingService struct {
	repo *postgres.BillingRepository
}

// NewBillingService creates a new BillingService.
func NewBillingService(repo *postgres.BillingRepository) *BillingService {
	return &BillingService{
		repo: repo,
	}
}

// GetBalance returns the current amount balance for a tenant.
// Auto-creates balance with free credits if none exists (for existing users).
func (s *BillingService) GetBalance(ctx context.Context, tenantID uuid.UUID) (*domain.Balance, error) {
	b, err := s.repo.GetBalance(ctx, tenantID)
	if err != nil {
		// Auto-create balance for existing users who don't have one
		if initErr := s.repo.InitBalance(ctx, tenantID); initErr != nil {
			return nil, fmt.Errorf("init balance: %w", initErr)
		}
		return s.repo.GetBalance(ctx, tenantID)
	}
	return b, nil
}

// EnsureBalance creates a balance record if none exists (called during registration).
func (s *BillingService) EnsureBalance(ctx context.Context, tenantID uuid.UUID) error {
	return s.repo.InitBalance(ctx, tenantID)
}

// Recharge adds amount to a tenant's balance (called after payment confirmed).
// This operation is transactional: update balance + create transaction record.
func (s *BillingService) Recharge(ctx context.Context, tenantID uuid.UUID, amountCents int64, paymentID uuid.UUID, description string) error {
	pool := s.repo.Pool()

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update balance
	balance, err := s.repo.UpdateBalance(ctx, tx, tenantID, amountCents)
	if err != nil {
		return fmt.Errorf("update balance: %w", err)
	}

	// Create transaction record
	txRecord := &domain.Transaction{
		ID:           uuid.New(),
		TenantID:     tenantID,
		Type:         domain.TransactionTypeRecharge,
		Amount:       amountCents,
		BalanceAfter: balance.AmountBalance,
		Description:  description,
		ReferenceID:  paymentID.String(),
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateTransaction(ctx, tx, txRecord); err != nil {
		return fmt.Errorf("create transaction record: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// Deduct removes amount from a tenant's balance (called per API request).
// This operation is transactional: check balance >= costCents, update balance, create transaction, create usage log.
// Returns error if insufficient balance.
// Fix: Uses Serializable isolation level to prevent over-deduction race conditions
func (s *BillingService) Deduct(ctx context.Context, tenantID uuid.UUID, tokensUsed int, model string, keyID uuid.UUID, latencyMs int) error {
	// Calculate cost based on model pricing (estimate: 50% input, 50% output)
	tokensIn := tokensUsed / 2
	tokensOut := tokensUsed - tokensIn
	costCents := domain.GetModelCost(model, tokensIn, tokensOut)

	// Fix: Start transaction with Serializable isolation to prevent concurrent over-deduction
	tx, err := s.repo.BeginSerializableTx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check balance with row lock
	currentBalance, err := s.repo.CheckBalance(ctx, tx, tenantID, costCents)
	if err != nil {
		return fmt.Errorf("check balance: %w", err)
	}

	if currentBalance < costCents {
		return fmt.Errorf("insufficient balance: have %d cents, need %d cents", currentBalance, costCents)
	}

	// Update balance (negative delta for consumption)
	balance, err := s.repo.UpdateBalance(ctx, tx, tenantID, -costCents)
	if err != nil {
		return fmt.Errorf("update balance: %w", err)
	}

	// Create transaction record
	txRecord := &domain.Transaction{
		ID:           uuid.New(),
		TenantID:     tenantID,
		Type:         domain.TransactionTypeConsume,
		Amount:       -costCents,
		BalanceAfter: balance.AmountBalance,
		Description:  fmt.Sprintf("API usage: %s", model),
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateTransaction(ctx, tx, txRecord); err != nil {
		return fmt.Errorf("create transaction record: %w", err)
	}

	// Create usage log
	usageLog := &domain.UsageLog{
		ID:          uuid.New(),
		TenantID:    tenantID,
		APIKeyID:    keyID,
		Model:       model,
		TokensIn:    tokensIn,
		TokensOut:   tokensOut,
		TokensTotal: tokensUsed,
		CostCents:   int(costCents),
		LatencyMs:   latencyMs,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateUsageLogTx(ctx, tx, usageLog); err != nil {
		return fmt.Errorf("create usage log: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// DeductWithDetails removes amount with detailed input/output tracking.
// Cost is calculated using GetModelCost based on model pricing.
// Fix: Uses Serializable isolation level to prevent over-deduction race conditions
func (s *BillingService) DeductWithDetails(ctx context.Context, tenantID uuid.UUID, tokensIn, tokensOut int, model string, keyID uuid.UUID, latencyMs int) error {
	tokensTotal := tokensIn + tokensOut
	costCents := domain.GetModelCost(model, tokensIn, tokensOut)

	// Fix: Start transaction with Serializable isolation to prevent concurrent over-deduction
	tx, err := s.repo.BeginSerializableTx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check balance with row lock
	currentBalance, err := s.repo.CheckBalance(ctx, tx, tenantID, costCents)
	if err != nil {
		return fmt.Errorf("check balance: %w", err)
	}

	if currentBalance < costCents {
		return fmt.Errorf("insufficient balance: have %d cents, need %d cents", currentBalance, costCents)
	}

	// Update balance (negative delta for consumption)
	balance, err := s.repo.UpdateBalance(ctx, tx, tenantID, -costCents)
	if err != nil {
		return fmt.Errorf("update balance: %w", err)
	}

	// Create transaction record
	txRecord := &domain.Transaction{
		ID:           uuid.New(),
		TenantID:     tenantID,
		Type:         domain.TransactionTypeConsume,
		Amount:       -costCents,
		BalanceAfter: balance.AmountBalance,
		Description:  fmt.Sprintf("API usage: %s (in: %d, out: %d, cost: %d cents)", model, tokensIn, tokensOut, costCents),
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateTransaction(ctx, tx, txRecord); err != nil {
		return fmt.Errorf("create transaction record: %w", err)
	}

	// Create usage log
	usageLog := &domain.UsageLog{
		ID:          uuid.New(),
		TenantID:    tenantID,
		APIKeyID:    keyID,
		Model:       model,
		TokensIn:    tokensIn,
		TokensOut:   tokensOut,
		TokensTotal: tokensTotal,
		CostCents:   int(costCents),
		LatencyMs:   latencyMs,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateUsageLogTx(ctx, tx, usageLog); err != nil {
		return fmt.Errorf("create usage log: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// ListTransactions returns paginated transaction history.
func (s *BillingService) ListTransactions(ctx context.Context, tenantID uuid.UUID, page, perPage int) ([]domain.Transaction, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	return s.repo.ListTransactions(ctx, tenantID, page, perPage)
}

// CreatePaymentOrder creates a new payment order.
func (s *BillingService) CreatePaymentOrder(ctx context.Context, tenantID uuid.UUID, method string, packageID string) (*domain.Payment, error) {
	// Find the package
	var pkg *domain.RechargePackage
	for _, p := range domain.RechargePackages {
		if p.ID == packageID {
			pkg = &p
			break
		}
	}
	if pkg == nil {
		return nil, fmt.Errorf("invalid package ID: %s", packageID)
	}

	// Validate payment method
	switch method {
	case domain.PaymentMethodAlipay, domain.PaymentMethodWechat, domain.PaymentMethodStripe:
		// Valid
	default:
		return nil, fmt.Errorf("invalid payment method: %s", method)
	}

	// Generate unique order number: WGH + timestamp + random
	orderNo := generateOrderNo()

	payment := &domain.Payment{
		ID:          uuid.New(),
		TenantID:    tenantID,
		OrderNo:     orderNo,
		AmountCents: pkg.AmountCents,
		Currency:    pkg.Currency,
		Method:      method,
		Status:      domain.PaymentStatusPending,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreatePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("create payment: %w", err)
	}

	return payment, nil
}

// HandlePaymentCallback processes payment success callback.
func (s *BillingService) HandlePaymentCallback(ctx context.Context, orderNo string, externalID string) error {
	// Get payment by order number
	payment, err := s.repo.GetPaymentByOrderNo(ctx, orderNo)
	if err != nil {
		return fmt.Errorf("get payment: %w", err)
	}

	// Check if payment is still pending
	if payment.Status != domain.PaymentStatusPending {
		return fmt.Errorf("payment is not pending, current status: %s", payment.Status)
	}

	// Update payment status to paid
	paidAt := time.Now()
	if err := s.repo.UpdatePaymentStatus(ctx, orderNo, domain.PaymentStatusPaid, externalID, &paidAt); err != nil {
		return fmt.Errorf("update payment status: %w", err)
	}

	// Recharge the tenant's balance with the amount (AmountCents)
	description := fmt.Sprintf("Recharge via %s (Order: %s)", payment.Method, payment.OrderNo)
	if err := s.Recharge(ctx, payment.TenantID, int64(payment.AmountCents), payment.ID, description); err != nil {
		// If recharge fails, we should ideally rollback the payment status update
		// For now, log the error - in production, this should be handled more carefully
		return fmt.Errorf("recharge failed after payment confirmation: %w", err)
	}

	return nil
}

// GetRechargePackages returns available recharge packages.
func (s *BillingService) GetRechargePackages() []domain.RechargePackage {
	return domain.RechargePackages
}

// GetUsageSummary retrieves usage statistics for a tenant since a given time.
func (s *BillingService) GetUsageSummary(ctx context.Context, tenantID uuid.UUID, since time.Time) (totalIn, totalOut int64, err error) {
	return s.repo.GetUsageSummary(ctx, tenantID, since)
}

// GetCostSummary retrieves the total cost (in cents) for a tenant since a given time.
func (s *BillingService) GetCostSummary(ctx context.Context, tenantID uuid.UUID, since time.Time) (int64, error) {
	return s.repo.GetCostSummary(ctx, tenantID, since)
}

// GetDailyStats retrieves daily usage statistics for the last N days.
func (s *BillingService) GetDailyStats(ctx context.Context, tenantID uuid.UUID, days int) ([]postgres.DailyStats, error) {
	if days < 1 {
		days = 7
	}
	if days > 90 {
		days = 90
	}
	return s.repo.GetDailyStats(ctx, tenantID, days)
}

// GetModelStats retrieves usage statistics grouped by model.
func (s *BillingService) GetModelStats(ctx context.Context, tenantID uuid.UUID, since time.Time) ([]postgres.ModelStats, error) {
	return s.repo.GetModelStats(ctx, tenantID, since)
}

// GetRequestCount retrieves the total number of requests since a given time.
func (s *BillingService) GetRequestCount(ctx context.Context, tenantID uuid.UUID, since time.Time) (int64, error) {
	return s.repo.GetRequestCount(ctx, tenantID, since)
}

// ListUsageLogs retrieves paginated usage logs for a tenant.
func (s *BillingService) ListUsageLogs(ctx context.Context, tenantID uuid.UUID, page, perPage int) ([]domain.UsageLog, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	return s.repo.ListUsageLogs(ctx, tenantID, page, perPage)
}

// generateOrderNo generates a unique order number.
// Format: WGH + YYYYMMDDHHMMSS + 6 random chars
func generateOrderNo() string {
	now := time.Now()
	timestamp := now.Format("20060102150405")
	randomPart := randomString(6)
	return fmt.Sprintf("WGH%s%s", timestamp, randomPart)
}

// randomString generates a random alphanumeric string of the given length.
func randomString(n int) string {
	const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
