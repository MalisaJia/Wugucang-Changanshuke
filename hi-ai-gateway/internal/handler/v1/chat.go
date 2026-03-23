package v1

import (
	"bufio"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"

	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/service"
	"github.com/hi-ai/gateway/internal/telemetry"
	"github.com/hi-ai/gateway/pkg/openai"
)

// ChatHandler handles OpenAI-compatible chat completion requests.
type ChatHandler struct {
	chatSvc *service.ChatService
}

// NewChatHandler creates a new chat handler.
func NewChatHandler(chatSvc *service.ChatService) *ChatHandler {
	return &ChatHandler{chatSvc: chatSvc}
}

// ChatCompletion handles POST /v1/chat/completions
func (h *ChatHandler) ChatCompletion(c *fiber.Ctx) error {
	var req openai.ChatCompletionRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body: " + err.Error())
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if req.Model == "" {
		e := apierr.New(apierr.CodeValidationError, "model is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if len(req.Messages) == 0 {
		e := apierr.New(apierr.CodeValidationError, "messages is required and must not be empty")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Handle streaming vs non-streaming
	if req.Stream {
		return h.handleStream(c, tc, &req)
	}

	return h.handleNonStream(c, tc, &req)
}

func (h *ChatHandler) handleNonStream(c *fiber.Ctx, tc *middleware.TenantContext, req *openai.ChatCompletionRequest) error {
	// Check balance before processing
	if err := h.chatSvc.CheckBalance(c.Context(), tc.TenantID); err != nil {
		if apiErr, ok := err.(*apierr.APIError); ok {
			return c.Status(apiErr.HTTPStatus).JSON(apiErr.ToResponse())
		}
	}

	resp, err := h.chatSvc.Complete(c.Context(), tc, req)
	if err != nil {
		if apiErr, ok := err.(*apierr.APIError); ok {
			return c.Status(apiErr.HTTPStatus).JSON(apiErr.ToResponse())
		}
		e := apierr.InternalError("internal server error")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	return c.JSON(resp)
}

func (h *ChatHandler) handleStream(c *fiber.Ctx, tc *middleware.TenantContext, req *openai.ChatCompletionRequest) error {
	start := time.Now()

	// Check balance before processing
	if err := h.chatSvc.CheckBalance(c.Context(), tc.TenantID); err != nil {
		if apiErr, ok := err.(*apierr.APIError); ok {
			return c.Status(apiErr.HTTPStatus).JSON(apiErr.ToResponse())
		}
	}

	ch, usageCallback, err := h.chatSvc.CompleteStream(c.Context(), tc, req)
	if err != nil {
		if apiErr, ok := err.(*apierr.APIError); ok {
			return c.Status(apiErr.HTTPStatus).JSON(apiErr.ToResponse())
		}
		e := apierr.InternalError("internal server error")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer telemetry.LLMActiveStreams.Dec()

		// Track accumulated content for token estimation
		var accumulatedContent string
		var lastUsage *openai.Usage

		for event := range ch {
			if event.Err != nil {
				break
			}
			if event.Chunk != nil {
				// Accumulate content for token estimation
				for _, choice := range event.Chunk.Choices {
					accumulatedContent += choice.Delta.Content
				}

				// Check if this chunk has usage info (usually in the last chunk)
				if event.Chunk.Usage != nil {
					lastUsage = event.Chunk.Usage
				}

				data, err := json.Marshal(event.Chunk)
				if err != nil {
					break
				}
				fmt.Fprintf(w, "data: %s\n\n", data)
				if err := w.Flush(); err != nil {
					break
				}
			}
		}
		fmt.Fprintf(w, "data: [DONE]\n\n")
		w.Flush()

		// Record usage after streaming completes
		if usageCallback != nil {
			latencyMs := int(time.Since(start).Milliseconds())

			if lastUsage != nil {
				// Use actual usage from the response
				usageCallback(lastUsage.PromptTokens, lastUsage.CompletionTokens, latencyMs)
			} else {
				// Estimate tokens from accumulated content
				// Estimate prompt tokens from request messages
				promptTokens := service.EstimateTokensFromMessages(req.Messages)
				// Estimate completion tokens from accumulated response content
				completionTokens := service.EstimateTokens(accumulatedContent)
				usageCallback(promptTokens, completionTokens, latencyMs)
			}
		}
	})

	return nil
}
