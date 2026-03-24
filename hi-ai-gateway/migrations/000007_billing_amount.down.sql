-- Rollback: Revert from amount-based billing back to token-based billing
-- WARNING: This rollback will lose cost tracking data and reset balances

-- 1. Drop the index on cost_cents
DROP INDEX IF EXISTS idx_usage_logs_cost_cents;

-- 2. Drop cost_cents column from usage_logs table
ALTER TABLE usage_logs DROP COLUMN IF EXISTS cost_cents;

-- 3. Add back token_amount column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS token_amount BIGINT NOT NULL DEFAULT 0;

-- 4. Rename amount_balance column back to token_balance
ALTER TABLE balances RENAME COLUMN amount_balance TO token_balance;
