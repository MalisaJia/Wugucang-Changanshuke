CREATE TABLE model_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    provider_name VARCHAR(100) NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    tags VARCHAR(500) DEFAULT '',
    price_input DECIMAL(10,6) DEFAULT 0,
    price_output DECIMAL(10,6) DEFAULT 0,
    max_context INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_configs_visible ON model_configs(visible);
CREATE INDEX idx_model_configs_priority ON model_configs(priority DESC);
CREATE INDEX idx_model_configs_provider ON model_configs(provider_name);
