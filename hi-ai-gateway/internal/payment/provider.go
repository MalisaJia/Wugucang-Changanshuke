package payment

import "errors"

// ErrNotConfigured indicates the payment provider is not configured.
var ErrNotConfigured = errors.New("payment provider not configured")

// PaymentProvider defines the interface for payment providers.
type PaymentProvider interface {
	// Name returns the provider name (e.g., "stripe", "alipay", "wechat").
	Name() string

	// CreateCheckout creates a payment session and returns a redirect URL or QR code.
	// Parameters:
	//   - orderNo: unique order number
	//   - amountCents: amount in cents (分)
	//   - currency: currency code (e.g., "CNY", "USD")
	//   - description: payment description
	//   - successURL: URL to redirect to after successful payment
	//   - cancelURL: URL to redirect to if payment is cancelled
	// Returns:
	//   - checkoutURL: URL for redirect or QR code content
	//   - error: any error that occurred
	CreateCheckout(orderNo string, amountCents int, currency string, description string, successURL string, cancelURL string) (string, error)

	// VerifyWebhook verifies the webhook signature.
	// Parameters:
	//   - payload: raw webhook payload
	//   - signature: signature from request header
	// Returns:
	//   - valid: whether the signature is valid
	//   - error: any error that occurred
	VerifyWebhook(payload []byte, signature string) (bool, error)

	// ParseCallback parses the callback payload and extracts order information.
	// Parameters:
	//   - payload: raw callback payload
	// Returns:
	//   - orderNo: the order number from metadata
	//   - externalID: the external payment ID (e.g., payment_intent ID for Stripe)
	//   - error: any error that occurred
	ParseCallback(payload []byte) (orderNo string, externalID string, err error)
}
