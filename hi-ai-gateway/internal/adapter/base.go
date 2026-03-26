package adapter

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"golang.org/x/net/http2"
)

// Fix: Connection pool tuning for 20K concurrent connections
const (
	// Increased connection pool limits for high concurrency
	maxIdleConns        = 500
	maxIdleConnsPerHost = 100
	maxConnsPerHost     = 200
	// Reduced timeout from 120s to 90s to prevent zombie connections
	clientTimeout       = 90 * time.Second
	idleConnTimeout     = 90 * time.Second
	tlsHandshakeTimeout = 10 * time.Second
	dialTimeout         = 30 * time.Second
	keepAliveInterval   = 30 * time.Second
)

// BaseAdapter provides shared HTTP client functionality for all adapters.
type BaseAdapter struct {
	client  *http.Client
	baseURL string
	apiKey  string
	id      string   // provider ID
	models  []string // supported models; empty means supports all
}

// NewBaseAdapter creates a base adapter with a configured HTTP client.
// Fix: Optimized for 20K concurrency with HTTP/2 support
func NewBaseAdapter(id, baseURL, apiKey string, models []string) BaseAdapter {
	// Create custom transport with optimized settings
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   dialTimeout,
			KeepAlive: keepAliveInterval,
		}).DialContext,
		MaxIdleConns:        maxIdleConns,
		MaxIdleConnsPerHost: maxIdleConnsPerHost,
		MaxConnsPerHost:     maxConnsPerHost,
		IdleConnTimeout:     idleConnTimeout,
		TLSHandshakeTimeout: tlsHandshakeTimeout,
		// Fix: Enable HTTP/2 connection reuse
		ForceAttemptHTTP2: true,
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
	}

	// Fix: Configure HTTP/2 transport for upstream provider connections
	http2.ConfigureTransport(transport)

	return BaseAdapter{
		client: &http.Client{
			Timeout:   clientTimeout,
			Transport: transport,
		},
		id:      id,
		baseURL: baseURL,
		apiKey:  apiKey,
		models:  models,
	}
}

// ID returns the provider identifier.
func (b *BaseAdapter) ID() string {
	return b.id
}

// APIKey returns the configured API key.
func (b *BaseAdapter) APIKey() string {
	return b.apiKey
}

// BaseURL returns the configured base URL.
func (b *BaseAdapter) BaseURL() string {
	return b.baseURL
}

// Models returns the list of supported models.
func (b *BaseAdapter) Models() []string {
	return b.models
}

// SupportsModel returns true if this provider supports the given model.
// If the provider's model list is empty, it supports all models.
func (b *BaseAdapter) SupportsModel(model string) bool {
	if len(b.models) == 0 {
		return true // Empty list means supports all models
	}
	for _, m := range b.models {
		if m == model {
			return true
		}
	}
	return false
}

// SupportsAllModels returns true if the provider has no specific model restrictions.
func (b *BaseAdapter) SupportsAllModels() bool {
	return len(b.models) == 0
}

// DoJSON performs a JSON request and decodes the response into result.
func (b *BaseAdapter) DoJSON(ctx context.Context, method, path string, body interface{}, headers map[string]string, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, b.baseURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := b.client.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("provider returned status %d: %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}

	return nil
}

// DoStream performs a streaming request and returns the response body for SSE parsing.
func (b *BaseAdapter) DoStream(ctx context.Context, method, path string, body interface{}, headers map[string]string) (io.ReadCloser, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, b.baseURL+path, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("provider returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return resp.Body, nil
}
