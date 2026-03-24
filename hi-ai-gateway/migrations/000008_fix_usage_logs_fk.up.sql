-- Allow api_key_id to be NULL for JWT-based usage (no API key)
ALTER TABLE usage_logs ALTER COLUMN api_key_id DROP NOT NULL;
ALTER TABLE usage_logs DROP CONSTRAINT IF EXISTS usage_logs_api_key_id_fkey;
ALTER TABLE usage_logs ADD CONSTRAINT usage_logs_api_key_id_fkey 
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL;
