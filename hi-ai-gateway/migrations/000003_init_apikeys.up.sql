-- API Keys table (virtual keys)
CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    created_by      UUID REFERENCES users(id),
    name            VARCHAR(255) NOT NULL,
    key_prefix      VARCHAR(12) NOT NULL,
    key_hash        VARCHAR(64) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    permissions     JSONB NOT NULL DEFAULT '[]',
    rate_limit_rpm  INT,
    rate_limit_tpm  INT,
    allowed_models  TEXT[],
    allowed_ips     INET[],
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_apikeys_hash ON api_keys(key_hash) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_apikeys_tenant ON api_keys(tenant_id);
