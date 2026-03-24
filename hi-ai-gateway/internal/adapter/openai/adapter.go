package openai

import (
	"context"
	"fmt"

	"github.com/hi-ai/gateway/internal/adapter"
	oai "github.com/hi-ai/gateway/pkg/openai"
)

// Adapter implements the Provider interface for OpenAI.
type Adapter struct {
	adapter.BaseAdapter
}

// New creates a new OpenAI adapter.
func New(id, baseURL, apiKey string, models []string) *Adapter {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return &Adapter{
		BaseAdapter: adapter.NewBaseAdapter(id, baseURL, apiKey, models),
	}
}

func (a *Adapter) headers() map[string]string {
	return map[string]string{
		"Authorization": "Bearer " + a.BaseAdapter.APIKey(),
	}
}

func (a *Adapter) ChatCompletion(ctx context.Context, req *oai.ChatCompletionRequest) (*oai.ChatCompletionResponse, error) {
	// Ensure stream is false for non-streaming requests
	reqCopy := *req
	reqCopy.Stream = false

	var resp oai.ChatCompletionResponse
	err := a.DoJSON(ctx, "POST", "/chat/completions", &reqCopy, a.headers(), &resp)
	if err != nil {
		return nil, fmt.Errorf("openai chat completion: %w", err)
	}
	return &resp, nil
}

func (a *Adapter) ChatCompletionStream(ctx context.Context, req *oai.ChatCompletionRequest) (<-chan adapter.StreamEvent, error) {
	// Ensure stream is true for streaming requests
	reqCopy := *req
	reqCopy.Stream = true
	// Request usage information in the final chunk
	reqCopy.StreamOptions = &oai.StreamOptions{IncludeUsage: true}

	body, err := a.DoStream(ctx, "POST", "/chat/completions", &reqCopy, a.headers())
	if err != nil {
		return nil, fmt.Errorf("openai chat completion stream: %w", err)
	}

	ch := make(chan adapter.StreamEvent, 64)
	go func() {
		defer close(ch)
		defer body.Close()

		reader := oai.NewSSEReader(body)
		for {
			data, err := reader.ReadEvent()
			if err != nil {
				if err.Error() != "EOF" {
					ch <- adapter.StreamEvent{Err: err}
				}
				return
			}

			chunk, err := oai.ParseChunk(data)
			if err != nil {
				ch <- adapter.StreamEvent{Err: fmt.Errorf("parse chunk: %w", err)}
				return
			}

			ch <- adapter.StreamEvent{Chunk: chunk}
		}
	}()

	return ch, nil
}

func (a *Adapter) ListModels(ctx context.Context) ([]oai.Model, error) {
	var resp oai.ModelList
	err := a.DoJSON(ctx, "GET", "/models", nil, a.headers(), &resp)
	if err != nil {
		return nil, fmt.Errorf("openai list models: %w", err)
	}
	return resp.Data, nil
}

func (a *Adapter) HealthCheck(ctx context.Context) error {
	_, err := a.ListModels(ctx)
	return err
}
