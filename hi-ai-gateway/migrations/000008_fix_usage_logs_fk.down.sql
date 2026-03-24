ALTER TABLE usage_logs DROP CONSTRAINT IF EXISTS usage_logs_api_key_id_fkey;
ALTER TABLE usage_logs ADD CONSTRAINT usage_logs_api_key_id_fkey 
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id);
ALTER TABLE usage_logs ALTER COLUMN api_key_id SET NOT NULL;
