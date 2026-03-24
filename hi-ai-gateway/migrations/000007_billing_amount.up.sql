-- Migration: Convert from token-based billing to amount-based billing (in cents)
-- This migration changes the billing system from tracking tokens to tracking money amounts.

-- 1. Rename token_balance column to amount_balance in balances table
ALTER TABLE balances RENAME COLUMN token_balance TO amount_balance;

-- 2. Reset existing balance data:
-- Give all existing users 100 cents (¥1.00) as free credit
-- Reset recharged and consumed counters since the units are changing
UPDATE balances SET amount_balance = 100 WHERE amount_balance > 0;
UPDATE balances SET total_recharged = 0, total_consumed = 0;

-- 3. Drop token_amount column from payments table (no longer needed)
ALTER TABLE payments DROP COLUMN IF EXISTS token_amount;

-- 4. Add cost_cents column to usage_logs table to track per-request costs
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS cost_cents INT NOT NULL DEFAULT 0;

-- 5. Create index on cost_cents for aggregation queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_cost_cents ON usage_logs(tenant_id, created_at, cost_cents);
