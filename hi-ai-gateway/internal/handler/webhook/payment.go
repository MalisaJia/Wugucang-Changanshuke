package webhook

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"

	"github.com/hi-ai/gateway/internal/payment"
	"github.com/hi-ai/gateway/internal/service"
)

// PaymentHandler handles payment webhook endpoints.
// These endpoints do NOT require JWT auth but must verify provider signatures.
type PaymentHandler struct {
	billingSvc *service.BillingService
	logger     *slog.Logger
}

// NewPaymentHandler creates a new payment webhook handler.
func NewPaymentHandler(billingSvc *service.BillingService, logger *slog.Logger) *PaymentHandler {
	return &PaymentHandler{
		billingSvc: billingSvc,
		logger:     logger,
	}
}

// StripeWebhook handles POST /api/webhooks/stripe
func (h *PaymentHandler) StripeWebhook(provider payment.PaymentProvider) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if provider == nil {
			h.logger.Warn("stripe webhook received but provider not configured")
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "stripe payment not configured",
			})
		}

		// Get raw body
		payload := c.Body()

		// Get Stripe-Signature header
		signature := c.Get("Stripe-Signature")
		if signature == "" {
			h.logger.Warn("stripe webhook missing signature header")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "missing Stripe-Signature header",
			})
		}

		// Verify webhook signature
		valid, err := provider.VerifyWebhook(payload, signature)
		if err != nil || !valid {
			h.logger.Warn("stripe webhook signature verification failed", "error", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid signature",
			})
		}

		// Parse callback to extract order info
		orderNo, externalID, err := provider.ParseCallback(payload)
		if err != nil {
			// Some events (like charge.succeeded) may not have order_no - that's okay
			h.logger.Debug("stripe webhook parse callback", "error", err)
			// Return 200 to acknowledge receipt even if we can't process
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"received": true,
				"message":  "event acknowledged but not processed",
			})
		}

		// Process payment callback
		if err := h.billingSvc.HandlePaymentCallback(c.Context(), orderNo, externalID); err != nil {
			h.logger.Error("failed to handle stripe payment callback",
				"error", err,
				"order_no", orderNo,
				"external_id", externalID,
			)
			// Return 200 to prevent Stripe from retrying
			// The order might already be processed (idempotency)
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"received": true,
				"error":    err.Error(),
			})
		}

		h.logger.Info("stripe payment processed successfully",
			"order_no", orderNo,
			"external_id", externalID,
		)

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"received": true,
			"order_no": orderNo,
		})
	}
}

// AlipayWebhook handles POST /api/webhooks/alipay
func (h *PaymentHandler) AlipayWebhook(provider payment.PaymentProvider) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if provider == nil {
			h.logger.Warn("alipay webhook received but provider not configured")
			// Alipay expects "fail" response when not processed
			return c.SendString("fail")
		}

		// Get raw body (form-urlencoded for Alipay)
		payload := c.Body()

		// For Alipay, signature is in the payload itself
		// Verify webhook signature
		valid, err := provider.VerifyWebhook(payload, "")
		if err != nil || !valid {
			h.logger.Warn("alipay webhook signature verification failed", "error", err)
			return c.SendString("fail")
		}

		// Parse callback to extract order info
		orderNo, externalID, err := provider.ParseCallback(payload)
		if err != nil {
			h.logger.Error("alipay webhook parse callback failed", "error", err)
			return c.SendString("fail")
		}

		// Process payment callback
		if err := h.billingSvc.HandlePaymentCallback(c.Context(), orderNo, externalID); err != nil {
			h.logger.Error("failed to handle alipay payment callback",
				"error", err,
				"order_no", orderNo,
				"external_id", externalID,
			)
			// Still return success if it's a duplicate (already processed)
			return c.SendString("success")
		}

		h.logger.Info("alipay payment processed successfully",
			"order_no", orderNo,
			"external_id", externalID,
		)

		// Alipay expects "success" response when processed successfully
		return c.SendString("success")
	}
}

// WechatWebhook handles POST /api/webhooks/wechat
func (h *PaymentHandler) WechatWebhook(provider payment.PaymentProvider) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if provider == nil {
			h.logger.Warn("wechat webhook received but provider not configured")
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"code":    "FAIL",
				"message": "wechat payment not configured",
			})
		}

		// Get raw body (JSON for WeChat v3)
		payload := c.Body()

		// Get WeChat signature headers
		// Wechatpay-Signature, Wechatpay-Timestamp, Wechatpay-Nonce
		signature := c.Get("Wechatpay-Signature")
		if signature == "" {
			h.logger.Warn("wechat webhook missing signature header")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"code":    "FAIL",
				"message": "missing Wechatpay-Signature header",
			})
		}

		// Verify webhook signature
		valid, err := provider.VerifyWebhook(payload, signature)
		if err != nil || !valid {
			h.logger.Warn("wechat webhook signature verification failed", "error", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"code":    "FAIL",
				"message": "invalid signature",
			})
		}

		// Parse callback to extract order info
		orderNo, externalID, err := provider.ParseCallback(payload)
		if err != nil {
			h.logger.Error("wechat webhook parse callback failed", "error", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"code":    "FAIL",
				"message": err.Error(),
			})
		}

		// Process payment callback
		if err := h.billingSvc.HandlePaymentCallback(c.Context(), orderNo, externalID); err != nil {
			h.logger.Error("failed to handle wechat payment callback",
				"error", err,
				"order_no", orderNo,
				"external_id", externalID,
			)
			// Return success for duplicate processing (idempotency)
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"code":    "SUCCESS",
				"message": "processed (possibly duplicate)",
			})
		}

		h.logger.Info("wechat payment processed successfully",
			"order_no", orderNo,
			"external_id", externalID,
		)

		// WeChat expects {"code": "SUCCESS"} response
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"code":    "SUCCESS",
			"message": "ok",
		})
	}
}
