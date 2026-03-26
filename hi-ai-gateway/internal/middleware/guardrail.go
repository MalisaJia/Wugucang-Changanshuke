package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/pkg/openai"
)

// Fix: ReDoS protection constants
const (
	// Maximum content length to scan with regex (prevents ReDoS attacks)
	maxContentLengthForRegex = 10000
	// Chunk size for splitting large content
	regexChunkSize = 5000
	// Timeout for regex execution
	regexTimeout = 100 * time.Millisecond
)

// PIIType represents a type of PII
type PIIType string

const (
	PIIEmail      PIIType = "email"
	PIIPhone      PIIType = "phone"
	PIISSNOrID    PIIType = "ssn_id"
	PIICreditCard PIIType = "credit_card"
	PIIIPAddress  PIIType = "ip_address"
)

// PIIPattern defines a regex pattern for detecting PII
type PIIPattern struct {
	Type        PIIType
	Pattern     *regexp.Regexp
	Replacement string // mask replacement like "[EMAIL]", "[PHONE]"
	Description string
}

// GuardrailMode defines behavior when PII is detected
type GuardrailMode string

const (
	GuardrailBlock GuardrailMode = "block" // reject the request
	GuardrailMask  GuardrailMode = "mask"  // replace PII with placeholders
	GuardrailOff   GuardrailMode = "off"   // disabled
)

// GuardrailConfig is per-tenant guardrail configuration
type GuardrailConfig struct {
	Mode     GuardrailMode
	Patterns []PIIType // which PII types to check
}

// PIIMatch represents a detected PII match
type PIIMatch struct {
	Type  PIIType
	Count int
}

// PIIRule represents a single PII detection rule for API response
type PIIRule struct {
	Name        string `json:"name"`
	Pattern     string `json:"pattern"`
	Enabled     bool   `json:"enabled"`
	Replacement string `json:"replacement"`
	Description string `json:"description"`
}

// GuardrailAPIConfig represents the guardrail configuration for API response
type GuardrailAPIConfig struct {
	Mode  GuardrailMode `json:"mode"`
	Rules []PIIRule     `json:"rules"`
}

// Guardrail provides PII detection and masking capabilities
type Guardrail struct {
	patterns    []PIIPattern
	logger      *slog.Logger
	mu          sync.RWMutex
	currentMode GuardrailMode
	enabledPII  map[PIIType]bool
}

// NewGuardrail creates a new Guardrail instance with compiled regex patterns
func NewGuardrail(logger *slog.Logger) *Guardrail {
	patterns := []PIIPattern{
		{
			Type:        PIIEmail,
			Pattern:     regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`),
			Replacement: "[EMAIL_REDACTED]",
			Description: "Email address",
		},
		{
			Type:        PIIPhone,
			Pattern:     regexp.MustCompile(`(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}`),
			Replacement: "[PHONE_REDACTED]",
			Description: "Phone number (international)",
		},
		{
			Type:        PIISSNOrID,
			Pattern:     regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),
			Replacement: "[ID_REDACTED]",
			Description: "US Social Security Number",
		},
		{
			Type:        PIISSNOrID,
			Pattern:     regexp.MustCompile(`\b\d{6}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b`),
			Replacement: "[ID_REDACTED]",
			Description: "Chinese ID number",
		},
		{
			Type: PIICreditCard,
			// Fix: Simplified regex to prevent ReDoS - removed problematic non-greedy quantifiers inside repetition
			// Original: `\b(?:\d[ -]*?){13,19}\b` - causes catastrophic backtracking
			// New: Matches common credit card formats without nested quantifiers
			Pattern:     regexp.MustCompile(`\b(?:\d{4}[- ]?){3}\d{1,4}\b|\b\d{13,19}\b`),
			Replacement: "[CARD_REDACTED]",
			Description: "Credit card number",
		},
		{
			Type:        PIIIPAddress,
			Pattern:     regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`),
			Replacement: "[IP_REDACTED]",
			Description: "IP address",
		},
	}

	// Initialize enabled PII types - all enabled by default
	enabledPII := make(map[PIIType]bool)
	enabledPII[PIIEmail] = true
	enabledPII[PIIPhone] = true
	enabledPII[PIISSNOrID] = true
	enabledPII[PIICreditCard] = true
	enabledPII[PIIIPAddress] = true

	return &Guardrail{
		patterns:    patterns,
		logger:      logger,
		currentMode: GuardrailMask, // default mode
		enabledPII:  enabledPII,
	}
}

// Middleware returns a Fiber middleware handler for PII detection
func (g *Guardrail) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Only process POST requests to chat completions endpoint
		if c.Method() != fiber.MethodPost {
			return c.Next()
		}

		// Try to parse the request body as ChatCompletionRequest
		var req openai.ChatCompletionRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			// If parsing fails, pass through (might not be a chat request)
			return c.Next()
		}

		// If no messages, pass through
		if len(req.Messages) == 0 {
			return c.Next()
		}

		// Get guardrail config from tenant settings
		config := g.getGuardrailConfig(c)

		// If guardrail is off, pass through
		if config.Mode == GuardrailOff {
			return c.Next()
		}

		// Determine which patterns to check
		activePatterns := g.getActivePatterns(config.Patterns)
		if len(activePatterns) == 0 {
			return c.Next()
		}

		// Scan all message content for PII
		matches, hasMatches := g.scanMessages(req.Messages, activePatterns)

		if !hasMatches {
			return c.Next()
		}

		// Log the guardrail trigger
		g.logTrigger(c, config.Mode, matches)

		// Handle based on mode
		if config.Mode == GuardrailBlock {
			return g.handleBlock(c, matches)
		}

		// Mode is "mask" - replace PII with placeholders
		return g.handleMask(c, &req, activePatterns)
	}
}

// getGuardrailConfig retrieves guardrail configuration from tenant context
func (g *Guardrail) getGuardrailConfig(c *fiber.Ctx) GuardrailConfig {
	// Default config: guardrail off
	config := GuardrailConfig{
		Mode:     GuardrailOff,
		Patterns: nil,
	}

	tc := GetTenantContext(c)
	if tc == nil {
		return config
	}

	// Check for tenant settings in Fiber locals
	// The tenant settings would be set by an earlier middleware that loads tenant data
	settings, ok := c.Locals("tenant_settings").(map[string]interface{})
	if !ok {
		return config
	}

	// Get guardrail config from settings
	guardrailSettings, ok := settings["guardrail"].(map[string]interface{})
	if !ok {
		return config
	}

	// Parse mode
	if mode, ok := guardrailSettings["mode"].(string); ok {
		switch GuardrailMode(mode) {
		case GuardrailBlock, GuardrailMask:
			config.Mode = GuardrailMode(mode)
		default:
			config.Mode = GuardrailOff
		}
	}

	// Parse patterns to check
	if patterns, ok := guardrailSettings["patterns"].([]interface{}); ok {
		for _, p := range patterns {
			if pStr, ok := p.(string); ok {
				config.Patterns = append(config.Patterns, PIIType(pStr))
			}
		}
	}

	return config
}

// getActivePatterns returns the patterns that should be checked based on config
func (g *Guardrail) getActivePatterns(enabledTypes []PIIType) []PIIPattern {
	// If no specific types configured, check all
	if len(enabledTypes) == 0 {
		return g.patterns
	}

	// Create a set of enabled types
	enabledSet := make(map[PIIType]bool)
	for _, t := range enabledTypes {
		enabledSet[t] = true
	}

	// Filter patterns
	var active []PIIPattern
	for _, p := range g.patterns {
		if enabledSet[p.Type] {
			active = append(active, p)
		}
	}

	return active
}

// scanMessages scans all message content for PII matches
// Fix: Added input length limit and chunking for ReDoS protection
func (g *Guardrail) scanMessages(messages []openai.Message, patterns []PIIPattern) (map[PIIType]int, bool) {
	matches := make(map[PIIType]int)
	hasMatches := false

	for _, msg := range messages {
		content := g.extractContent(msg.Content)
		if content == "" {
			continue
		}

		// Fix: Scan content safely with length protection
		msgMatches := g.scanContentSafe(content, patterns)
		for piiType, count := range msgMatches {
			matches[piiType] += count
			if count > 0 {
				hasMatches = true
			}
		}
	}

	return matches, hasMatches
}

// scanContentSafe scans content for PII with ReDoS protection
// Fix: Splits large content into chunks and uses timeout for regex execution
func (g *Guardrail) scanContentSafe(content string, patterns []PIIPattern) map[PIIType]int {
	matches := make(map[PIIType]int)

	// If content is too large, process in chunks
	if len(content) > maxContentLengthForRegex {
		g.logger.Warn("content exceeds max length for regex, processing in chunks",
			"content_length", len(content),
			"max_length", maxContentLengthForRegex,
		)

		// Split into overlapping chunks to avoid missing matches at boundaries
		for i := 0; i < len(content); i += regexChunkSize {
			end := i + regexChunkSize + 100 // 100 char overlap for boundary matches
			if end > len(content) {
				end = len(content)
			}
			chunk := content[i:end]

			chunkMatches := g.scanChunkWithTimeout(chunk, patterns)
			for piiType, count := range chunkMatches {
				matches[piiType] += count
			}
		}
		return matches
	}

	return g.scanChunkWithTimeout(content, patterns)
}

// scanChunkWithTimeout scans a chunk of content with timeout protection
func (g *Guardrail) scanChunkWithTimeout(content string, patterns []PIIPattern) map[PIIType]int {
	matches := make(map[PIIType]int)

	for _, pattern := range patterns {
		// Fix: Use context with timeout for regex execution to prevent ReDoS
		ctx, cancel := context.WithTimeout(context.Background(), regexTimeout)

		done := make(chan []string, 1)
		go func() {
			found := pattern.Pattern.FindAllString(content, -1)
			done <- found
		}()

		select {
		case found := <-done:
			matches[pattern.Type] += len(found)
		case <-ctx.Done():
			g.logger.Warn("regex execution timed out",
				"pattern_type", pattern.Type,
				"content_length", len(content),
			)
			// Continue to next pattern - timeout is a safety measure
		}

		cancel()
	}

	return matches
}

// extractContent extracts string content from a message's Content field
// Content can be a string or an array of content parts
func (g *Guardrail) extractContent(content interface{}) string {
	if content == nil {
		return ""
	}

	// Handle string content
	if str, ok := content.(string); ok {
		return str
	}

	// Handle array content (e.g., for multimodal messages)
	if arr, ok := content.([]interface{}); ok {
		var parts []string
		for _, item := range arr {
			if itemMap, ok := item.(map[string]interface{}); ok {
				// Look for text content in the item
				if text, ok := itemMap["text"].(string); ok {
					parts = append(parts, text)
				}
			}
		}
		return strings.Join(parts, " ")
	}

	return ""
}

// logTrigger logs when guardrail is triggered
func (g *Guardrail) logTrigger(c *fiber.Ctx, mode GuardrailMode, matches map[PIIType]int) {
	tc := GetTenantContext(c)
	tenantID := ""
	userID := ""
	if tc != nil {
		tenantID = tc.TenantID
		userID = tc.UserID
	}

	g.logger.Warn("guardrail triggered",
		slog.String("action", string(mode)),
		slog.String("tenant_id", tenantID),
		slog.String("user_id", userID),
		slog.String("request_id", c.Get("X-Request-ID")),
		slog.Any("pii_detected", matches),
	)
}

// handleBlock returns an error response when PII is detected in block mode
func (g *Guardrail) handleBlock(c *fiber.Ctx, matches map[PIIType]int) error {
	// Build a message describing what was detected
	var detected []string
	for piiType, count := range matches {
		detected = append(detected, formatPIIDetection(piiType, count))
	}

	message := "Request blocked: PII detected in message content - " + strings.Join(detected, ", ")
	e := apierr.New(apierr.CodeGuardrailViolation, message)
	return c.Status(e.HTTPStatus).JSON(e.ToResponse())
}

// handleMask masks PII in the request and forwards it
func (g *Guardrail) handleMask(c *fiber.Ctx, req *openai.ChatCompletionRequest, patterns []PIIPattern) error {
	// Mask PII in all message content
	for i := range req.Messages {
		req.Messages[i].Content = g.maskContent(req.Messages[i].Content, patterns)
	}

	// Re-serialize the request body
	newBody, err := json.Marshal(req)
	if err != nil {
		g.logger.Error("failed to marshal masked request", slog.String("error", err.Error()))
		e := apierr.InternalError("failed to process request")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Set the new body
	c.Request().SetBody(newBody)
	c.Request().Header.SetContentLength(len(newBody))

	return c.Next()
}

// maskContent masks PII in content, handling both string and array content
func (g *Guardrail) maskContent(content interface{}, patterns []PIIPattern) interface{} {
	if content == nil {
		return nil
	}

	// Handle string content
	if str, ok := content.(string); ok {
		return g.maskString(str, patterns)
	}

	// Handle array content
	if arr, ok := content.([]interface{}); ok {
		result := make([]interface{}, len(arr))
		for i, item := range arr {
			if itemMap, ok := item.(map[string]interface{}); ok {
				newMap := make(map[string]interface{})
				for k, v := range itemMap {
					if k == "text" {
						if text, ok := v.(string); ok {
							newMap[k] = g.maskString(text, patterns)
						} else {
							newMap[k] = v
						}
					} else {
						newMap[k] = v
					}
				}
				result[i] = newMap
			} else {
				result[i] = item
			}
		}
		return result
	}

	return content
}

// maskString replaces all PII in a string with their respective placeholders
func (g *Guardrail) maskString(s string, patterns []PIIPattern) string {
	result := s
	for _, pattern := range patterns {
		result = pattern.Pattern.ReplaceAllString(result, pattern.Replacement)
	}
	return result
}

// formatPIIDetection formats a PII detection for error messages
func formatPIIDetection(piiType PIIType, count int) string {
	names := map[PIIType]string{
		PIIEmail:      "email address",
		PIIPhone:      "phone number",
		PIISSNOrID:    "ID number",
		PIICreditCard: "credit card number",
		PIIIPAddress:  "IP address",
	}

	name, ok := names[piiType]
	if !ok {
		name = string(piiType)
	}

	if count == 1 {
		return "1 " + name
	}
	return fmt.Sprintf("%d %ss", count, name)
}

// GetConfig returns the current guardrail configuration (thread-safe)
func (g *Guardrail) GetConfig() GuardrailAPIConfig {
	g.mu.RLock()
	defer g.mu.RUnlock()

	rules := make([]PIIRule, 0, len(g.patterns))
	seenTypes := make(map[PIIType]bool)

	for _, p := range g.patterns {
		// Skip duplicate types (e.g., SSN and Chinese ID are both PIISSNOrID)
		if seenTypes[p.Type] {
			continue
		}
		seenTypes[p.Type] = true

		enabled := g.enabledPII[p.Type]
		rules = append(rules, PIIRule{
			Name:        string(p.Type),
			Pattern:     p.Pattern.String(),
			Enabled:     enabled,
			Replacement: p.Replacement,
			Description: p.Description,
		})
	}

	return GuardrailAPIConfig{
		Mode:  g.currentMode,
		Rules: rules,
	}
}

// UpdateConfig updates the guardrail configuration (thread-safe)
func (g *Guardrail) UpdateConfig(cfg GuardrailAPIConfig) {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Update mode
	g.currentMode = cfg.Mode

	// Update enabled status for each rule
	for _, rule := range cfg.Rules {
		piiType := PIIType(rule.Name)
		g.enabledPII[piiType] = rule.Enabled
	}

	g.logger.Info("guardrail configuration updated",
		"mode", cfg.Mode,
		"rules_count", len(cfg.Rules),
	)
}
