# WuguHub Gateway - Detailed Design Document

## 1. Project Overview

**WuguHub** is an enterprise-grade, open-source, lightweight LLM aggregation gateway. It provides a unified OpenAI-compatible API to access 250+ models from 8+ providers, with smart routing, reliability features, security governance, and observability.

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       WuguHub Gateway                              │
│                                                                  │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌────────┐  ┌────┐│
│  │ Ingress │─▶│ Routing  │─▶│Enhancement │─▶│Adapter │─▶│Out ││
│  │  Layer  │  │  Layer   │  │   Layer    │  │ Layer  │  │    ││
│  └─────────┘  └──────────┘  └────────────┘  └────────┘  └────┘│
│      │             │              │              │           │   │
│  Auth, Rate    Route Select   Cache, Guard   Provider    Metrics│
│  Limit, Parse  Fallback, LB  PII Mask       Translate   Audit  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                Cross-Cutting Concerns                     │   │
│  │  Telemetry │ Circuit Breaker │ Config │ Tenant Context   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │PostgreSQL│  │  Redis   │  │  Milvus  │  │Prometheus│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Request Pipeline

1. HTTP request arrives → Fiber handler parses into unified `ChatCompletionRequest`
2. **Auth middleware** extracts virtual key, resolves tenant + permissions
3. **Rate limiter** checks tenant/key/model quotas in Redis
4. **Guardrail pre-processor** scans input against rules
5. **PII masker** redacts sensitive fields
6. **Cache layer** checks Redis (exact match) → Milvus (semantic match)
7. **Router** selects target provider(s) via configured strategy
8. **Circuit breaker** gates the call per model/tenant/composite key
9. **Adapter** translates unified request → provider-native format → calls upstream → translates response
10. **Retry engine** wraps adapter call with configurable backoff
11. **Cache writer** stores successful responses
12. **Guardrail post-processor** scans output
13. **Telemetry** records latency, tokens, cost, status
14. **Audit logger** writes structured log entry
15. Response returned to client

### 2.3 Design Principles

1. **Unified API First** — OpenAI compatible, low integration cost
2. **Modular Layered** — Decoupled layers, easy to extend
3. **Lightweight High-Performance** — High concurrency, low latency (<10ms overhead)
4. **Production Ready** — Built-in retry, cache, rate limiting, monitoring, security

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| Gateway Core | Golang 1.22+ / Fiber v2 |
| Routing/Rate-limiting/Circuit-breaking | Custom rule engine + Redis + sony/gobreaker |
| Cache | Redis 7 (basic) + Milvus 2.3 (semantic) |
| Adapter Layer | Plugin-based Provider adapters |
| Observability | Prometheus + Grafana |
| Storage | PostgreSQL 16 + Redis 7 + Milvus 2.3 |
| Deployment | Docker + Kubernetes |
| Frontend | Next.js 14+ / React 18 / TypeScript / Tailwind / shadcn/ui |

## 4. Core Module Design

### 4.1 Unified API Layer

OpenAI-compatible proxy endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | Chat completion (streaming + non-streaming) |
| POST | `/v1/completions` | Text completion (legacy) |
| POST | `/v1/embeddings` | Generate embeddings |
| GET | `/v1/models` | List available models |

Management API:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user + tenant |
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/refresh` | Refresh token |
| GET/POST/DELETE | `/api/keys` | Virtual key CRUD |
| CRUD | `/api/providers` | Provider config management |
| CRUD | `/api/routing/rules` | Routing rules management |
| CRUD | `/api/guardrails` | Guardrail rules management |
| GET | `/api/dashboard/*` | Dashboard aggregate data |
| GET | `/api/audit/logs` | Audit log queries |
| GET | `/api/usage/*` | Usage and billing data |
| GET | `/healthz` | Liveness probe |
| GET | `/readyz` | Readiness probe |
| GET | `/metrics` | Prometheus metrics |

### 4.2 Smart Routing Engine

Four routing modes:
1. **Single** — Direct to one provider/model
2. **Fallback** — Ordered chain, try next on failure
3. **Loadbalance** — Weighted round-robin or least-latency
4. **Conditional** — Rule-based routing (model match, content, token count, time-of-day, tenant tier)

### 4.3 Reliability & Performance

- **Auto-retry**: Exponential backoff, configurable max attempts
- **Basic Cache**: Redis exact-match by request hash, configurable TTL
- **Semantic Cache**: Milvus cosine similarity with layered thresholds
  - Strict: >= 0.95 → return cached
  - Loose: 0.85-0.95 → reusable, marked
  - Miss: < 0.85 → normal call
  - Embedding: text-embedding-3-small (EN) / bge-large-zh (CN)
- **Streaming**: SSE support for chat completions
- **Rate Limiting**: Redis sliding window per tenant/key/model
- **Circuit Breaker**: sony/gobreaker with model-level + tenant-level + composite keys

### 4.4 Security & Governance

- **Guardrails**: 40+ rules (content safety, prompt injection, toxicity, etc.)
- **PII Masking**: Regex + pattern detection (emails, phones, IDs, credit cards)
- **RBAC**: Roles: owner, admin, member, viewer
- **Audit Logging**: Full request/response logging with structured fields

### 4.5 Observability

- **Prometheus metrics**: 50+ AI-specific metrics
- **Grafana dashboards**: Pre-built dashboard JSON
- **Structured logging**: JSON format with request ID correlation
- **Jaeger + Loki**: Deferred to post-MVP

### 4.6 Multi-Model Support

8 provider adapters:

| Provider | API Style | Key Models |
|----------|-----------|-----------|
| OpenAI | OpenAI API | GPT-4o, GPT-4, GPT-3.5-turbo |
| Anthropic | Messages API | Claude 3.5 Sonnet, Claude 3 Opus/Haiku |
| Google | Gemini API | Gemini 1.5 Pro, Gemini 1.5 Flash |
| Ollama | OpenAI-compatible | Llama 3, Mistral, etc. |
| Qwen | DashScope API | Qwen-Max, Qwen-Plus, Qwen-Turbo |
| Zhipu AI | Zhipu API | GLM-4, GLM-4-Flash |
| MiniMax | MiniMax API | abab6.5-chat, abab5.5-chat |
| Moonshot | OpenAI-compatible | moonshot-v1-8k/32k/128k |

## 5. Database Schema

### 5.1 tenants
```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    plan            VARCHAR(50) NOT NULL DEFAULT 'free',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    settings        JSONB NOT NULL DEFAULT '{}',
    rate_limit_rpm  INT NOT NULL DEFAULT 60,
    rate_limit_tpm  INT NOT NULL DEFAULT 100000,
    max_keys        INT NOT NULL DEFAULT 5,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
```

### 5.2 users
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255),
    role            VARCHAR(50) NOT NULL DEFAULT 'member',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE(tenant_id, email)
);
```

### 5.3 api_keys
```sql
CREATE TABLE api_keys (
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
```

### 5.4 provider_configs
```sql
CREATE TABLE provider_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    provider_id     VARCHAR(50) NOT NULL,
    display_name    VARCHAR(255),
    api_key_enc     BYTEA NOT NULL,
    base_url        VARCHAR(500),
    org_id          VARCHAR(255),
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    model_mappings  JSONB NOT NULL DEFAULT '{}',
    extra_config    JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, provider_id)
);
```

### 5.5 routing_rules
```sql
CREATE TABLE routing_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    mode            VARCHAR(20) NOT NULL,
    priority        INT NOT NULL DEFAULT 0,
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    match_criteria  JSONB NOT NULL DEFAULT '{}',
    targets         JSONB NOT NULL,
    fallback_config JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.6 audit_logs
```sql
CREATE TABLE audit_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    api_key_id        UUID,
    user_id           UUID,
    request_id        VARCHAR(100) NOT NULL,
    endpoint          VARCHAR(255) NOT NULL,
    method            VARCHAR(10) NOT NULL,
    provider_id       VARCHAR(50),
    model             VARCHAR(100),
    status_code       INT NOT NULL,
    latency_ms        INT NOT NULL,
    prompt_tokens     INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens      INT DEFAULT 0,
    estimated_cost    DECIMAL(12, 6) DEFAULT 0,
    cache_hit         BOOLEAN DEFAULT false,
    cache_type        VARCHAR(20),
    routing_mode      VARCHAR(20),
    error_code        VARCHAR(50),
    error_message     TEXT,
    client_ip         INET,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.7 usage_hourly
```sql
CREATE TABLE usage_hourly (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    api_key_id        UUID,
    provider_id       VARCHAR(50) NOT NULL,
    model             VARCHAR(100) NOT NULL,
    hour              TIMESTAMPTZ NOT NULL,
    request_count     INT NOT NULL DEFAULT 0,
    success_count     INT NOT NULL DEFAULT 0,
    error_count       INT NOT NULL DEFAULT 0,
    prompt_tokens     BIGINT NOT NULL DEFAULT 0,
    completion_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens      BIGINT NOT NULL DEFAULT 0,
    estimated_cost    DECIMAL(12, 6) NOT NULL DEFAULT 0,
    cache_hits        INT NOT NULL DEFAULT 0,
    avg_latency_ms    INT NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, api_key_id, provider_id, model, hour)
);
```

## 6. MVP Scope

### Phase 1 (Current)
- [x] OpenAI-compatible `/v1/chat/completions` (stream + non-stream)
- [x] OpenAI provider adapter
- [x] Single routing mode
- [x] Virtual key authentication
- [x] JWT-based management API auth
- [x] Basic Prometheus metrics
- [x] Basic Redis rate limiting
- [x] Health endpoints
- [x] Landing page (bilingual EN/ZH)
- [x] Login/Register pages

### Phase 2
- [ ] Fallback, Loadbalance, Conditional routing
- [ ] All 8 provider adapters
- [ ] Auto-retry with exponential backoff
- [ ] Redis basic cache + Milvus semantic cache
- [ ] Circuit breaker (model/tenant/composite)
- [ ] Guardrails (40+ rules)
- [ ] PII masking
- [ ] Enhanced RBAC
- [ ] Audit logging
- [ ] 50+ Prometheus metrics

### Phase 3
- [ ] Full dashboard UI
- [ ] API key management UI
- [ ] Model explorer UI
- [ ] Routing configuration UI
- [ ] Analytics charts
- [ ] MDX documentation (bilingual)

## 7. Deployment

### Docker Compose (Development)
Services: gateway, postgres, redis, prometheus, grafana

### Kubernetes (Production)
- Deployment with HPA (min 2, max 10 replicas)
- Service (ClusterIP) + Ingress
- ConfigMap for config.yaml
- Secret for provider API keys
- PersistentVolumeClaim for PostgreSQL

## 8. SaaS Requirements
- Multi-tenant isolation at DB query level (tenant_id in every query)
- Subscription plans: free, starter, pro, enterprise
- Usage-based billing tracking (usage_hourly table)
- Data encryption at rest (provider API keys)
- Audit trail for compliance
