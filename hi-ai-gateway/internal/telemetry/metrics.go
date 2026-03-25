package telemetry

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// AI-specific Prometheus metrics for the gateway.
var (
	LLMRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hiai_llm_requests_total",
			Help: "Total number of LLM requests by provider and model",
		},
		[]string{"provider", "model", "status", "tenant_id"},
	)

	LLMRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "hiai_llm_request_duration_seconds",
			Help:    "LLM request duration in seconds",
			Buckets: []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120},
		},
		[]string{"provider", "model"},
	)

	LLMTokensTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hiai_llm_tokens_total",
			Help: "Total tokens consumed by type",
		},
		[]string{"provider", "model", "type", "tenant_id"},
	)

	LLMCacheHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hiai_llm_cache_hits_total",
			Help: "Total cache hits by type",
		},
		[]string{"cache_type", "tenant_id"},
	)

	LLMCacheMisses = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hiai_llm_cache_misses_total",
			Help: "Total cache misses",
		},
		[]string{"tenant_id"},
	)

	LLMProviderErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hiai_llm_provider_errors_total",
			Help: "Total provider errors",
		},
		[]string{"provider", "error_type"},
	)

	LLMActiveStreams = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "hiai_llm_active_streams",
			Help: "Number of active streaming connections",
		},
	)

	LLMEstimatedCost = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hiai_llm_estimated_cost_usd",
			Help: "Estimated cost in USD",
		},
		[]string{"provider", "model", "tenant_id"},
	)

	CircuitBreakerState = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "hiai_llm_circuit_breaker_state",
			Help: "Current circuit breaker state (0=closed, 1=half-open, 2=open)",
		},
		[]string{"provider", "model"},
	)

	RetriesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hiai_llm_retries_total",
			Help: "Total number of retry attempts",
		},
		[]string{"provider", "model", "attempt"},
	)
)

// RecordRequest records metrics for a completed LLM request.
func RecordRequest(provider, model, status, tenantID string, durationSec float64, promptTokens, completionTokens int) {
	LLMRequestsTotal.WithLabelValues(provider, model, status, tenantID).Inc()
	LLMRequestDuration.WithLabelValues(provider, model).Observe(durationSec)

	if promptTokens > 0 {
		LLMTokensTotal.WithLabelValues(provider, model, "prompt", tenantID).Add(float64(promptTokens))
	}
	if completionTokens > 0 {
		LLMTokensTotal.WithLabelValues(provider, model, "completion", tenantID).Add(float64(completionTokens))
	}
}
