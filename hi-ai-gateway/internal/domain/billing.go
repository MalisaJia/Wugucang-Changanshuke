package domain

import (
	"math"
	"time"

	"github.com/google/uuid"
)

// ModelPricing defines the price for each model (unit: cents per 1M tokens).
type ModelPricing struct {
	Model       string
	InputPer1M  int64 // Input price: cents per 1M tokens
	OutputPer1M int64 // Output price: cents per 1M tokens
}

// DefaultModelPricing defines the default pricing for models (following EntroFlux pricing strategy).
var DefaultModelPricing = map[string]ModelPricing{
	"gpt-3.5-turbo":              {Model: "gpt-3.5-turbo", InputPer1M: 25, OutputPer1M: 75},                 // ¥0.25/¥0.75 per 1M
	"gpt-4":                      {Model: "gpt-4", InputPer1M: 1500, OutputPer1M: 3000},                     // ¥15/¥30 per 1M
	"gpt-4o":                     {Model: "gpt-4o", InputPer1M: 250, OutputPer1M: 500},                      // ¥2.5/¥5 per 1M
	"gpt-4o-mini":                {Model: "gpt-4o-mini", InputPer1M: 15, OutputPer1M: 30},                   // ¥0.15/¥0.30 per 1M
	"claude-3.5-sonnet":          {Model: "claude-3.5-sonnet", InputPer1M: 300, OutputPer1M: 1500},          // ¥3/¥15 per 1M
	"claude-opus-4-6":            {Model: "claude-opus-4-6", InputPer1M: 1500, OutputPer1M: 3000},           // ¥15/¥30 per 1M
	"claude-opus-4-6-thinking":   {Model: "claude-opus-4-6-thinking", InputPer1M: 1500, OutputPer1M: 3000},  // ¥15/¥30 per 1M
	"claude-sonnet-4-6-thinking": {Model: "claude-sonnet-4-6-thinking", InputPer1M: 300, OutputPer1M: 1500}, // ¥3/¥15 per 1M
	"gemini-2.5-flash-thinking":  {Model: "gemini-2.5-flash-thinking", InputPer1M: 15, OutputPer1M: 60},    // ¥0.15/¥0.60 per 1M
}

// GetModelCost calculates the cost for an API call (unit: cents, minimum 1 cent).
func GetModelCost(model string, tokensIn, tokensOut int) int64 {
	pricing, ok := DefaultModelPricing[model]
	if !ok {
		// Unknown model uses default pricing (gpt-3.5-turbo price)
		pricing = DefaultModelPricing["gpt-3.5-turbo"]
	}
	inputCost := float64(tokensIn) * float64(pricing.InputPer1M) / 1_000_000.0
	outputCost := float64(tokensOut) * float64(pricing.OutputPer1M) / 1_000_000.0
	totalCents := int64(math.Ceil(inputCost + outputCost))
	if totalCents < 1 {
		totalCents = 1 // Minimum charge: 1 cent
	}
	return totalCents
}

// Balance represents a tenant's amount balance (unit: cents).
type Balance struct {
	TenantID       uuid.UUID `json:"tenant_id"`
	AmountBalance  int64     `json:"amount_balance"`  // Current balance in cents
	TotalRecharged int64     `json:"total_recharged"` // Total recharged in cents
	TotalConsumed  int64     `json:"total_consumed"`  // Total consumed in cents
	UpdatedAt      time.Time `json:"updated_at"`
}

// Transaction represents a billing transaction record.
type Transaction struct {
	ID           uuid.UUID `json:"id"`
	TenantID     uuid.UUID `json:"tenant_id"`
	Type         string    `json:"type"`           // "recharge" | "consume" | "refund"
	Amount       int64     `json:"amount"`         // positive for recharge, negative for consume
	BalanceAfter int64     `json:"balance_after"`
	Description  string    `json:"description"`
	ReferenceID  string    `json:"reference_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// Payment represents a payment order.
type Payment struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	OrderNo     string     `json:"order_no"`
	AmountCents int        `json:"amount_cents"` // in cents (分)
	Currency    string     `json:"currency"`
	Method      string     `json:"method"` // "alipay" | "wechat" | "stripe"
	Status      string     `json:"status"` // "pending" | "paid" | "failed" | "refunded"
	ExternalID  string     `json:"external_id,omitempty"`
	PaidAt      *time.Time `json:"paid_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// UsageLog represents an API usage record.
type UsageLog struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	APIKeyID    uuid.UUID `json:"api_key_id,omitempty"`
	Model       string    `json:"model"`
	TokensIn    int       `json:"tokens_in"`
	TokensOut   int       `json:"tokens_out"`
	TokensTotal int       `json:"tokens_total"`
	CostCents   int       `json:"cost_cents"` // Cost in cents for this request
	LatencyMs   int       `json:"latency_ms"`
	CreatedAt   time.Time `json:"created_at"`
}

// RechargePackage represents a predefined recharge package.
type RechargePackage struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AmountCents int    `json:"amount_cents"` // price in cents (also the amount added to balance)
	Currency    string `json:"currency"`
}

// RechargePackages defines the available recharge packages (pure amount recharge).
var RechargePackages = []RechargePackage{
	{ID: "pkg_50", Name: "50 元", AmountCents: 5000, Currency: "CNY"},
	{ID: "pkg_100", Name: "100 元", AmountCents: 10000, Currency: "CNY"},
	{ID: "pkg_500", Name: "500 元", AmountCents: 50000, Currency: "CNY"},
	{ID: "pkg_1000", Name: "1000 元", AmountCents: 100000, Currency: "CNY"},
	{ID: "pkg_5000", Name: "5000 元", AmountCents: 500000, Currency: "CNY"},
	{ID: "pkg_10000", Name: "10000 元", AmountCents: 1000000, Currency: "CNY"},
}

// Payment methods.
const (
	PaymentMethodAlipay = "alipay"
	PaymentMethodWechat = "wechat"
	PaymentMethodStripe = "stripe"
)

// Transaction types.
const (
	TransactionTypeRecharge = "recharge"
	TransactionTypeConsume  = "consume"
	TransactionTypeRefund   = "refund"
)

// Payment statuses.
const (
	PaymentStatusPending  = "pending"
	PaymentStatusPaid     = "paid"
	PaymentStatusFailed   = "failed"
	PaymentStatusRefunded = "refunded"
)
