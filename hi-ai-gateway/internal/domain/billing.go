package domain

import (
	"time"

	"github.com/google/uuid"
)

// Balance represents a tenant's token balance.
type Balance struct {
	TenantID       uuid.UUID `json:"tenant_id"`
	TokenBalance   int64     `json:"token_balance"`
	TotalRecharged int64     `json:"total_recharged"`
	TotalConsumed  int64     `json:"total_consumed"`
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
	TokenAmount int64      `json:"token_amount"`
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
	LatencyMs   int       `json:"latency_ms"`
	CreatedAt   time.Time `json:"created_at"`
}

// RechargePackage represents a predefined recharge package.
type RechargePackage struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AmountCents int    `json:"amount_cents"` // price in cents
	TokenAmount int64  `json:"token_amount"`
	Currency    string `json:"currency"`
}

// RechargePackages defines the available recharge packages.
var RechargePackages = []RechargePackage{
	{ID: "pkg_50", Name: "200K Tokens", AmountCents: 5000, TokenAmount: 200000, Currency: "CNY"},
	{ID: "pkg_100", Name: "500K Tokens", AmountCents: 10000, TokenAmount: 500000, Currency: "CNY"},
	{ID: "pkg_186", Name: "Pro Monthly", AmountCents: 18600, TokenAmount: 500000, Currency: "CNY"},
	{ID: "pkg_500", Name: "1.5M Tokens", AmountCents: 50000, TokenAmount: 1500000, Currency: "CNY"},
	{ID: "pkg_1288", Name: "Pro Yearly", AmountCents: 128800, TokenAmount: 6000000, Currency: "CNY"},
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
