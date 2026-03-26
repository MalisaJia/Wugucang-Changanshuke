package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hi-ai/gateway/internal/domain"
)

// BillingRepository handles billing-related persistence operations.
type BillingRepository struct {
	db *DB
}

// NewBillingRepository creates a new BillingRepository.
func NewBillingRepository(db *DB) *BillingRepository {
	return &BillingRepository{db: db}
}

// Pool returns the underlying connection pool for transaction support.
func (r *BillingRepository) Pool() *pgxpool.Pool {
	return r.db.pool
}

// BeginSerializableTx starts a transaction with Serializable isolation level.
// Fix: Prevents concurrent requests from over-deducting balance (race condition)
func (r *BillingRepository) BeginSerializableTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.Serializable,
	})
}

// BeginRepeatableReadTx starts a transaction with Repeatable Read isolation level.
// Fix: Provides snapshot isolation for balance operations
func (r *BillingRepository) BeginRepeatableReadTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.RepeatableRead,
	})
}

// =====================
// Balance Operations
// =====================

// GetBalance retrieves the current balance for a tenant.
func (r *BillingRepository) GetBalance(ctx context.Context, tenantID uuid.UUID) (*domain.Balance, error) {
	query := `
		SELECT tenant_id, amount_balance, total_recharged, total_consumed, updated_at
		FROM balances
		WHERE tenant_id = $1
	`

	var b domain.Balance
	err := r.db.pool.QueryRow(ctx, query, tenantID).Scan(
		&b.TenantID,
		&b.AmountBalance,
		&b.TotalRecharged,
		&b.TotalConsumed,
		&b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("balance not found for tenant: %s", tenantID)
		}
		return nil, fmt.Errorf("get balance: %w", err)
	}

	return &b, nil
}

// InitBalance creates an initial balance record for a tenant (100 cents = ¥1.00 free credit).
func (r *BillingRepository) InitBalance(ctx context.Context, tenantID uuid.UUID) error {
	query := `
		INSERT INTO balances (tenant_id, amount_balance, total_recharged, total_consumed, updated_at)
		VALUES ($1, 100, 0, 0, $2)
		ON CONFLICT (tenant_id) DO NOTHING
	`

	_, err := r.db.pool.Exec(ctx, query, tenantID, time.Now())
	if err != nil {
		return fmt.Errorf("init balance: %w", err)
	}

	return nil
}

// UpdateBalance atomically updates a tenant's balance within a transaction.
// delta is positive for recharge, negative for consume.
// Returns the updated balance.
func (r *BillingRepository) UpdateBalance(ctx context.Context, tx pgx.Tx, tenantID uuid.UUID, delta int64) (*domain.Balance, error) {
	var query string
	now := time.Now()

	if delta >= 0 {
		// Recharge: increment balance and total_recharged
		query = `
			UPDATE balances
			SET amount_balance = amount_balance + $2,
			    total_recharged = total_recharged + $2,
			    updated_at = $3
			WHERE tenant_id = $1
			RETURNING tenant_id, amount_balance, total_recharged, total_consumed, updated_at
		`
	} else {
		// Consume: decrement balance and increment total_consumed
		query = `
			UPDATE balances
			SET amount_balance = amount_balance + $2,
			    total_consumed = total_consumed + $3,
			    updated_at = $4
			WHERE tenant_id = $1
			RETURNING tenant_id, amount_balance, total_recharged, total_consumed, updated_at
		`
	}

	var b domain.Balance
	var err error

	if delta >= 0 {
		err = tx.QueryRow(ctx, query, tenantID, delta, now).Scan(
			&b.TenantID,
			&b.AmountBalance,
			&b.TotalRecharged,
			&b.TotalConsumed,
			&b.UpdatedAt,
		)
	} else {
		// For consume, we pass delta (negative) to add to balance, and -delta (positive) to add to total_consumed
		err = tx.QueryRow(ctx, query, tenantID, delta, -delta, now).Scan(
			&b.TenantID,
			&b.AmountBalance,
			&b.TotalRecharged,
			&b.TotalConsumed,
			&b.UpdatedAt,
		)
	}

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("balance not found for tenant: %s", tenantID)
		}
		return nil, fmt.Errorf("update balance: %w", err)
	}

	return &b, nil
}

// CheckBalance checks if tenant has sufficient balance (used before deduction).
func (r *BillingRepository) CheckBalance(ctx context.Context, tx pgx.Tx, tenantID uuid.UUID, required int64) (int64, error) {
	query := `SELECT amount_balance FROM balances WHERE tenant_id = $1 FOR UPDATE`

	var balance int64
	err := tx.QueryRow(ctx, query, tenantID).Scan(&balance)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, fmt.Errorf("balance not found for tenant: %s", tenantID)
		}
		return 0, fmt.Errorf("check balance: %w", err)
	}

	return balance, nil
}

// =====================
// Transaction Operations
// =====================

// CreateTransaction inserts a new transaction record within a transaction.
func (r *BillingRepository) CreateTransaction(ctx context.Context, tx pgx.Tx, t *domain.Transaction) error {
	query := `
		INSERT INTO transactions (id, tenant_id, type, amount, balance_after, description, reference_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := tx.Exec(ctx, query,
		t.ID,
		t.TenantID,
		t.Type,
		t.Amount,
		t.BalanceAfter,
		t.Description,
		t.ReferenceID,
		t.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("create transaction: %w", err)
	}

	return nil
}

// ListTransactions retrieves paginated transactions for a tenant.
// Returns (transactions, total count, error).
func (r *BillingRepository) ListTransactions(ctx context.Context, tenantID uuid.UUID, page, perPage int) ([]domain.Transaction, int, error) {
	// Get total count
	countQuery := `SELECT COUNT(*) FROM transactions WHERE tenant_id = $1`
	var totalCount int
	err := r.db.pool.QueryRow(ctx, countQuery, tenantID).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("count transactions: %w", err)
	}

	// Calculate offset
	offset := (page - 1) * perPage
	if offset < 0 {
		offset = 0
	}

	// Get paginated results
	query := `
		SELECT id, tenant_id, type, amount, balance_after, description, reference_id, created_at
		FROM transactions
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.pool.Query(ctx, query, tenantID, perPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query transactions: %w", err)
	}
	defer rows.Close()

	var transactions []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		var refID *string
		err := rows.Scan(
			&t.ID,
			&t.TenantID,
			&t.Type,
			&t.Amount,
			&t.BalanceAfter,
			&t.Description,
			&refID,
			&t.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan transaction row: %w", err)
		}
		if refID != nil {
			t.ReferenceID = *refID
		}
		transactions = append(transactions, t)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate transactions: %w", err)
	}

	return transactions, totalCount, nil
}

// =====================
// Payment Operations
// =====================

// CreatePayment inserts a new payment order.
func (r *BillingRepository) CreatePayment(ctx context.Context, p *domain.Payment) error {
	query := `
		INSERT INTO payments (id, tenant_id, order_no, amount_cents, currency, method, status, external_id, paid_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := r.db.pool.Exec(ctx, query,
		p.ID,
		p.TenantID,
		p.OrderNo,
		p.AmountCents,
		p.Currency,
		p.Method,
		p.Status,
		p.ExternalID,
		p.PaidAt,
		p.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("create payment: %w", err)
	}

	return nil
}

// GetPaymentByOrderNo retrieves a payment by its order number.
func (r *BillingRepository) GetPaymentByOrderNo(ctx context.Context, orderNo string) (*domain.Payment, error) {
	query := `
		SELECT id, tenant_id, order_no, amount_cents, currency, method, status, external_id, paid_at, created_at
		FROM payments
		WHERE order_no = $1
	`

	var p domain.Payment
	var externalID *string
	err := r.db.pool.QueryRow(ctx, query, orderNo).Scan(
		&p.ID,
		&p.TenantID,
		&p.OrderNo,
		&p.AmountCents,
		&p.Currency,
		&p.Method,
		&p.Status,
		&externalID,
		&p.PaidAt,
		&p.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("payment not found: %s", orderNo)
		}
		return nil, fmt.Errorf("get payment: %w", err)
	}

	if externalID != nil {
		p.ExternalID = *externalID
	}

	return &p, nil
}

// UpdatePaymentStatus updates a payment's status.
func (r *BillingRepository) UpdatePaymentStatus(ctx context.Context, orderNo string, status string, externalID string, paidAt *time.Time) error {
	query := `
		UPDATE payments
		SET status = $2, external_id = $3, paid_at = $4
		WHERE order_no = $1
	`

	result, err := r.db.pool.Exec(ctx, query, orderNo, status, externalID, paidAt)
	if err != nil {
		return fmt.Errorf("update payment status: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("payment not found: %s", orderNo)
	}

	return nil
}

// =====================
// Usage Operations
// =====================

// CreateUsageLog inserts a new usage log entry.
func (r *BillingRepository) CreateUsageLog(ctx context.Context, log *domain.UsageLog) error {
	query := `
		INSERT INTO usage_logs (id, tenant_id, api_key_id, model, tokens_in, tokens_out, tokens_total, cost_cents, latency_ms, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	// Handle NULL api_key_id for JWT-based users (no API key)
	var keyIDParam interface{}
	if log.APIKeyID != uuid.Nil {
		keyIDParam = log.APIKeyID
	} else {
		keyIDParam = nil
	}

	_, err := r.db.pool.Exec(ctx, query,
		log.ID,
		log.TenantID,
		keyIDParam,
		log.Model,
		log.TokensIn,
		log.TokensOut,
		log.TokensTotal,
		log.CostCents,
		log.LatencyMs,
		log.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("create usage log: %w", err)
	}

	return nil
}

// CreateUsageLogTx inserts a new usage log entry within a transaction.
func (r *BillingRepository) CreateUsageLogTx(ctx context.Context, tx pgx.Tx, log *domain.UsageLog) error {
	query := `
		INSERT INTO usage_logs (id, tenant_id, api_key_id, model, tokens_in, tokens_out, tokens_total, cost_cents, latency_ms, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	// Handle NULL api_key_id for JWT-based users (no API key)
	var keyIDParam interface{}
	if log.APIKeyID != uuid.Nil {
		keyIDParam = log.APIKeyID
	} else {
		keyIDParam = nil
	}

	_, err := tx.Exec(ctx, query,
		log.ID,
		log.TenantID,
		keyIDParam,
		log.Model,
		log.TokensIn,
		log.TokensOut,
		log.TokensTotal,
		log.CostCents,
		log.LatencyMs,
		log.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("create usage log: %w", err)
	}

	return nil
}

// GetUsageSummary retrieves the total tokens consumed since a given time.
func (r *BillingRepository) GetUsageSummary(ctx context.Context, tenantID uuid.UUID, since time.Time) (totalIn, totalOut int64, err error) {
	query := `
		SELECT COALESCE(SUM(tokens_in), 0), COALESCE(SUM(tokens_out), 0)
		FROM usage_logs
		WHERE tenant_id = $1 AND created_at >= $2
	`

	err = r.db.pool.QueryRow(ctx, query, tenantID, since).Scan(&totalIn, &totalOut)
	if err != nil {
		return 0, 0, fmt.Errorf("get usage summary: %w", err)
	}

	return totalIn, totalOut, nil
}

// GetCostSummary retrieves the total cost (in cents) since a given time.
func (r *BillingRepository) GetCostSummary(ctx context.Context, tenantID uuid.UUID, since time.Time) (totalCostCents int64, err error) {
	query := `
		SELECT COALESCE(SUM(cost_cents), 0)
		FROM usage_logs
		WHERE tenant_id = $1 AND created_at >= $2
	`

	err = r.db.pool.QueryRow(ctx, query, tenantID, since).Scan(&totalCostCents)
	if err != nil {
		return 0, fmt.Errorf("get cost summary: %w", err)
	}

	return totalCostCents, nil
}

// DailyStats represents daily usage statistics.
type DailyStats struct {
	Date         time.Time `json:"date"`
	TokensIn     int64     `json:"tokens_in"`
	TokensOut    int64     `json:"tokens_out"`
	TokensTotal  int64     `json:"tokens_total"`
	RequestCount int64     `json:"request_count"`
}

// GetDailyStats retrieves daily usage statistics for the last N days.
func (r *BillingRepository) GetDailyStats(ctx context.Context, tenantID uuid.UUID, days int) ([]DailyStats, error) {
	query := `
		SELECT 
			DATE(created_at) as date,
			COALESCE(SUM(tokens_in), 0) as tokens_in,
			COALESCE(SUM(tokens_out), 0) as tokens_out,
			COALESCE(SUM(tokens_total), 0) as tokens_total,
			COUNT(*) as request_count
		FROM usage_logs
		WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
		GROUP BY DATE(created_at)
		ORDER BY date DESC
	`

	rows, err := r.db.pool.Query(ctx, query, tenantID, days)
	if err != nil {
		return nil, fmt.Errorf("get daily stats: %w", err)
	}
	defer rows.Close()

	var stats []DailyStats
	for rows.Next() {
		var s DailyStats
		if err := rows.Scan(&s.Date, &s.TokensIn, &s.TokensOut, &s.TokensTotal, &s.RequestCount); err != nil {
			return nil, fmt.Errorf("scan daily stats: %w", err)
		}
		stats = append(stats, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate daily stats: %w", err)
	}

	return stats, nil
}

// ModelStats represents usage statistics by model.
type ModelStats struct {
	Model        string `json:"model"`
	TokensIn     int64  `json:"tokens_in"`
	TokensOut    int64  `json:"tokens_out"`
	TokensTotal  int64  `json:"tokens_total"`
	RequestCount int64  `json:"request_count"`
}

// GetModelStats retrieves usage statistics grouped by model.
func (r *BillingRepository) GetModelStats(ctx context.Context, tenantID uuid.UUID, since time.Time) ([]ModelStats, error) {
	query := `
		SELECT 
			model,
			COALESCE(SUM(tokens_in), 0) as tokens_in,
			COALESCE(SUM(tokens_out), 0) as tokens_out,
			COALESCE(SUM(tokens_total), 0) as tokens_total,
			COUNT(*) as request_count
		FROM usage_logs
		WHERE tenant_id = $1 AND created_at >= $2
		GROUP BY model
		ORDER BY tokens_total DESC
	`

	rows, err := r.db.pool.Query(ctx, query, tenantID, since)
	if err != nil {
		return nil, fmt.Errorf("get model stats: %w", err)
	}
	defer rows.Close()

	var stats []ModelStats
	for rows.Next() {
		var s ModelStats
		if err := rows.Scan(&s.Model, &s.TokensIn, &s.TokensOut, &s.TokensTotal, &s.RequestCount); err != nil {
			return nil, fmt.Errorf("scan model stats: %w", err)
		}
		stats = append(stats, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate model stats: %w", err)
	}

	return stats, nil
}

// GetRequestCount retrieves the total number of requests since a given time.
func (r *BillingRepository) GetRequestCount(ctx context.Context, tenantID uuid.UUID, since time.Time) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM usage_logs
		WHERE tenant_id = $1 AND created_at >= $2
	`

	var count int64
	err := r.db.pool.QueryRow(ctx, query, tenantID, since).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("get request count: %w", err)
	}

	return count, nil
}

// ListUsageLogs retrieves paginated usage logs for a tenant.
func (r *BillingRepository) ListUsageLogs(ctx context.Context, tenantID uuid.UUID, page, perPage int) ([]domain.UsageLog, int, error) {
	// Get total count
	countQuery := `SELECT COUNT(*) FROM usage_logs WHERE tenant_id = $1`
	var totalCount int
	err := r.db.pool.QueryRow(ctx, countQuery, tenantID).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("count usage logs: %w", err)
	}

	// Calculate offset
	offset := (page - 1) * perPage
	if offset < 0 {
		offset = 0
	}

	// Get paginated results
	query := `
		SELECT id, tenant_id, api_key_id, model, tokens_in, tokens_out, tokens_total, cost_cents, latency_ms, created_at
		FROM usage_logs
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.pool.Query(ctx, query, tenantID, perPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query usage logs: %w", err)
	}
	defer rows.Close()

	var logs []domain.UsageLog
	for rows.Next() {
		var log domain.UsageLog
		var apiKeyID *uuid.UUID
		err := rows.Scan(
			&log.ID,
			&log.TenantID,
			&apiKeyID,
			&log.Model,
			&log.TokensIn,
			&log.TokensOut,
			&log.TokensTotal,
			&log.CostCents,
			&log.LatencyMs,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan usage log: %w", err)
		}
		if apiKeyID != nil {
			log.APIKeyID = *apiKeyID
		}
		logs = append(logs, log)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate usage logs: %w", err)
	}

	return logs, totalCount, nil
}

// =====================
// Admin/Global Queries
// =====================

// GetBalanceByTenantID retrieves balance for a specific tenant (admin use).
func (r *BillingRepository) GetBalanceByTenantID(ctx context.Context, tenantID string) (*domain.Balance, error) {
	query := `
		SELECT tenant_id, amount_balance, total_recharged, total_consumed, updated_at
		FROM balances
		WHERE tenant_id = $1
	`

	var b domain.Balance
	err := r.db.pool.QueryRow(ctx, query, tenantID).Scan(
		&b.TenantID,
		&b.AmountBalance,
		&b.TotalRecharged,
		&b.TotalConsumed,
		&b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("balance not found for tenant: %s", tenantID)
		}
		return nil, fmt.Errorf("get balance: %w", err)
	}

	return &b, nil
}

// AdjustBalanceByTenantID adjusts balance for a tenant and creates a transaction record.
// Used by admin for manual balance adjustments.
func (r *BillingRepository) AdjustBalanceByTenantID(ctx context.Context, tenantID string, adjustment int64, reason string) error {
	tx, err := r.db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update balance
	now := time.Now()
	var newBalance int64

	if adjustment >= 0 {
		// Adding amount
		query := `
			UPDATE balances
			SET amount_balance = amount_balance + $2,
			    total_recharged = total_recharged + $2,
			    updated_at = $3
			WHERE tenant_id = $1
			RETURNING amount_balance
		`
		err = tx.QueryRow(ctx, query, tenantID, adjustment, now).Scan(&newBalance)
	} else {
		// Deducting amount
		query := `
			UPDATE balances
			SET amount_balance = amount_balance + $2,
			    updated_at = $3
			WHERE tenant_id = $1
			RETURNING amount_balance
		`
		err = tx.QueryRow(ctx, query, tenantID, adjustment, now).Scan(&newBalance)
	}

	if err != nil {
		return fmt.Errorf("update balance: %w", err)
	}

	// Create transaction record
	txRecord := `
		INSERT INTO transactions (id, tenant_id, type, amount, balance_after, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	txType := "admin_adjustment"
	_, err = tx.Exec(ctx, txRecord,
		uuid.New(),
		tenantID,
		txType,
		adjustment,
		newBalance,
		reason,
		now,
	)
	if err != nil {
		return fmt.Errorf("create transaction record: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// ProcessRefund adds balance for refund and creates a refund transaction record.
func (r *BillingRepository) ProcessRefund(ctx context.Context, tenantID string, amount int64, reason string) error {
	tx, err := r.db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update balance (add amount for refund)
	now := time.Now()
	query := `
		UPDATE balances
		SET amount_balance = amount_balance + $2,
		    total_recharged = total_recharged + $2,
		    updated_at = $3
		WHERE tenant_id = $1
		RETURNING amount_balance
	`
	var newBalance int64
	err = tx.QueryRow(ctx, query, tenantID, amount, now).Scan(&newBalance)
	if err != nil {
		return fmt.Errorf("update balance: %w", err)
	}

	// Create refund transaction record
	txRecord := `
		INSERT INTO transactions (id, tenant_id, type, amount, balance_after, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err = tx.Exec(ctx, txRecord,
		uuid.New(),
		tenantID,
		"refund",
		amount,
		newBalance,
		reason,
		now,
	)
	if err != nil {
		return fmt.Errorf("create refund record: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// GetTotalRevenue returns the sum of all recharge transactions.
func (r *BillingRepository) GetTotalRevenue(ctx context.Context) (int64, error) {
	query := `SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'recharge'`
	var total int64
	err := r.db.pool.QueryRow(ctx, query).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("get total revenue: %w", err)
	}
	return total, nil
}

// GetTotalRequestsToday returns the count of all requests today.
func (r *BillingRepository) GetTotalRequestsToday(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM usage_logs WHERE created_at >= CURRENT_DATE`
	var count int64
	err := r.db.pool.QueryRow(ctx, query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("get total requests: %w", err)
	}
	return count, nil
}

// ListRecentTransactions retrieves the most recent transactions across all tenants.
func (r *BillingRepository) ListRecentTransactions(ctx context.Context, limit int) ([]domain.Transaction, error) {
	query := `
		SELECT id, tenant_id, type, amount, balance_after, description, reference_id, created_at
		FROM transactions
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := r.db.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query transactions: %w", err)
	}
	defer rows.Close()

	var transactions []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		var refID *string
		err := rows.Scan(
			&t.ID,
			&t.TenantID,
			&t.Type,
			&t.Amount,
			&t.BalanceAfter,
			&t.Description,
			&refID,
			&t.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan transaction row: %w", err)
		}
		if refID != nil {
			t.ReferenceID = *refID
		}
		transactions = append(transactions, t)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate transactions: %w", err)
	}

	return transactions, nil
}

// ListRefundTransactions retrieves all refund type transactions with pagination.
func (r *BillingRepository) ListRefundTransactions(ctx context.Context, page, perPage int) ([]domain.Transaction, int, error) {
	// Get total count
	countQuery := `SELECT COUNT(*) FROM transactions WHERE type = 'refund' OR type = 'admin_adjustment'`
	var totalCount int
	err := r.db.pool.QueryRow(ctx, countQuery).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("count refund transactions: %w", err)
	}

	offset := (page - 1) * perPage
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT id, tenant_id, type, amount, balance_after, description, reference_id, created_at
		FROM transactions
		WHERE type = 'refund' OR type = 'admin_adjustment'
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.pool.Query(ctx, query, perPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query refund transactions: %w", err)
	}
	defer rows.Close()

	var transactions []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		var refID *string
		err := rows.Scan(
			&t.ID,
			&t.TenantID,
			&t.Type,
			&t.Amount,
			&t.BalanceAfter,
			&t.Description,
			&refID,
			&t.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan transaction row: %w", err)
		}
		if refID != nil {
			t.ReferenceID = *refID
		}
		transactions = append(transactions, t)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate transactions: %w", err)
	}

	return transactions, totalCount, nil
}

// ListAllTransactions retrieves all transactions across all tenants with pagination and filters.
// statusFilter and methodFilter are optional (empty string means no filter).
func (r *BillingRepository) ListAllTransactions(ctx context.Context, page, perPage int, statusFilter, methodFilter string) ([]domain.Transaction, int, error) {
	// Build count query with filters
	countQuery := `SELECT COUNT(*) FROM transactions WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if statusFilter != "" {
		countQuery += fmt.Sprintf(" AND type = $%d", argIndex)
		args = append(args, statusFilter)
		argIndex++
	}

	var totalCount int
	err := r.db.pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("count all transactions: %w", err)
	}

	offset := (page - 1) * perPage
	if offset < 0 {
		offset = 0
	}

	// Build main query with filters
	query := `
		SELECT id, tenant_id, type, amount, balance_after, description, reference_id, created_at
		FROM transactions
		WHERE 1=1
	`

	args = []interface{}{}
	argIndex = 1

	if statusFilter != "" {
		query += fmt.Sprintf(" AND type = $%d", argIndex)
		args = append(args, statusFilter)
		argIndex++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, perPage, offset)

	rows, err := r.db.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query all transactions: %w", err)
	}
	defer rows.Close()

	var transactions []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		var refID *string
		err := rows.Scan(
			&t.ID,
			&t.TenantID,
			&t.Type,
			&t.Amount,
			&t.BalanceAfter,
			&t.Description,
			&refID,
			&t.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan transaction row: %w", err)
		}
		if refID != nil {
			t.ReferenceID = *refID
		}
		transactions = append(transactions, t)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate transactions: %w", err)
	}

	return transactions, totalCount, nil
}
