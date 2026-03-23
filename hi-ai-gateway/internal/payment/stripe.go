package payment

import (
	"encoding/json"
	"fmt"

	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/webhook"
)

// StripeProvider implements PaymentProvider for Stripe.
type StripeProvider struct {
	secretKey     string
	webhookSecret string
}

// NewStripeProvider creates a new Stripe payment provider.
func NewStripeProvider(secretKey, webhookSecret string) *StripeProvider {
	// Set the global Stripe API key
	stripe.Key = secretKey

	return &StripeProvider{
		secretKey:     secretKey,
		webhookSecret: webhookSecret,
	}
}

// Name returns the provider name.
func (p *StripeProvider) Name() string {
	return "stripe"
}

// CreateCheckout creates a Stripe Checkout Session and returns the checkout URL.
func (p *StripeProvider) CreateCheckout(orderNo string, amountCents int, currency string, description string, successURL string, cancelURL string) (string, error) {
	if p.secretKey == "" {
		return "", ErrNotConfigured
	}

	// Convert currency to lowercase for Stripe (e.g., "CNY" -> "cny")
	stripeCurrency := currency
	if stripeCurrency == "" {
		stripeCurrency = "cny"
	}

	// Create checkout session params
	params := &stripe.CheckoutSessionParams{
		Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String(stripeCurrency),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name:        stripe.String(description),
						Description: stripe.String(fmt.Sprintf("Order: %s", orderNo)),
					},
					UnitAmount: stripe.Int64(int64(amountCents)),
				},
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Metadata: map[string]string{
			"order_no": orderNo,
		},
		PaymentIntentData: &stripe.CheckoutSessionPaymentIntentDataParams{
			Metadata: map[string]string{
				"order_no": orderNo,
			},
		},
	}

	// Create the session
	sess, err := session.New(params)
	if err != nil {
		return "", fmt.Errorf("create stripe checkout session: %w", err)
	}

	return sess.URL, nil
}

// VerifyWebhook verifies the Stripe webhook signature.
func (p *StripeProvider) VerifyWebhook(payload []byte, signature string) (bool, error) {
	if p.webhookSecret == "" {
		return false, ErrNotConfigured
	}

	_, err := webhook.ConstructEvent(payload, signature, p.webhookSecret)
	if err != nil {
		return false, fmt.Errorf("verify webhook signature: %w", err)
	}

	return true, nil
}

// ParseCallback parses the Stripe webhook payload and extracts order information.
func (p *StripeProvider) ParseCallback(payload []byte) (orderNo string, externalID string, err error) {
	if p.webhookSecret == "" {
		return "", "", ErrNotConfigured
	}

	// Parse the event (signature already verified by VerifyWebhook)
	var event stripe.Event
	if err := json.Unmarshal(payload, &event); err != nil {
		return "", "", fmt.Errorf("parse webhook event: %w", err)
	}

	// Only process checkout.session.completed events
	if event.Type != "checkout.session.completed" {
		return "", "", fmt.Errorf("unsupported event type: %s", event.Type)
	}

	// Parse the checkout session from the event data
	var sess stripe.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
		return "", "", fmt.Errorf("parse checkout session: %w", err)
	}

	// Extract order_no from metadata
	orderNo, ok := sess.Metadata["order_no"]
	if !ok || orderNo == "" {
		return "", "", fmt.Errorf("order_no not found in metadata")
	}

	// Use PaymentIntent ID as external ID
	if sess.PaymentIntent != nil {
		externalID = sess.PaymentIntent.ID
	} else {
		externalID = sess.ID // fallback to session ID
	}

	return orderNo, externalID, nil
}
