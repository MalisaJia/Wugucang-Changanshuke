package adapter

import (
	"context"

	"github.com/hi-ai/gateway/pkg/openai"
)

// Provider defines the interface that all LLM provider adapters must implement.
type Provider interface {
	// ID returns the unique provider identifier (e.g., "openai", "anthropic").
	ID() string

	// ChatCompletion sends a non-streaming chat completion request.
	ChatCompletion(ctx context.Context, req *openai.ChatCompletionRequest) (*openai.ChatCompletionResponse, error)

	// ChatCompletionStream sends a streaming chat completion request.
	// The returned channel emits chunks until the stream ends, then closes.
	ChatCompletionStream(ctx context.Context, req *openai.ChatCompletionRequest) (<-chan StreamEvent, error)

	// ListModels returns the models available from this provider.
	ListModels(ctx context.Context) ([]openai.Model, error)

	// HealthCheck tests connectivity to the provider.
	HealthCheck(ctx context.Context) error

	// SupportsModel returns true if this provider supports the given model.
	// If the provider's model list is empty, it supports all models.
	SupportsModel(model string) bool

	// SupportsAllModels returns true if the provider has no specific model restrictions.
	SupportsAllModels() bool
}

// StreamEvent represents a single event in a streaming response.
type StreamEvent struct {
	Chunk *openai.ChatCompletionChunk
	Err   error
}

// Registry manages registered provider adapters.
type Registry struct {
	providers map[string]Provider
}

// NewRegistry creates a new adapter registry.
func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]Provider),
	}
}

// Register adds a provider to the registry.
func (r *Registry) Register(p Provider) {
	r.providers[p.ID()] = p
}

// Get retrieves a provider by ID.
func (r *Registry) Get(id string) (Provider, bool) {
	p, ok := r.providers[id]
	return p, ok
}

// List returns all registered provider IDs.
func (r *Registry) List() []string {
	ids := make([]string, 0, len(r.providers))
	for id := range r.providers {
		ids = append(ids, id)
	}
	return ids
}

// ListProviders returns all registered providers.
func (r *Registry) ListProviders() []Provider {
	providers := make([]Provider, 0, len(r.providers))
	for _, p := range r.providers {
		providers = append(providers, p)
	}
	return providers
}
