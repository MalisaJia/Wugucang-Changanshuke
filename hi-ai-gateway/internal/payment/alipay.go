package payment

// AlipayProvider implements PaymentProvider for Alipay.
// TODO: When merchant account is ready, implement using:
// - github.com/smartwalle/alipay/v3 (recommended)
// - or github.com/go-pay/gopay (alternative)
//
// Required configuration:
// - app_id: 应用ID
// - private_key: 应用私钥 (RSA2)
// - alipay_public_key: 支付宝公钥
// - notify_url: 异步通知地址
// - return_url: 同步跳转地址
type AlipayProvider struct {
	appID      string
	privateKey string
	// TODO: Add alipay client when implemented
	// client *alipay.Client
}

// NewAlipayProvider creates a new Alipay payment provider.
func NewAlipayProvider(appID, privateKey string) *AlipayProvider {
	return &AlipayProvider{
		appID:      appID,
		privateKey: privateKey,
	}
}

// Name returns the provider name.
func (p *AlipayProvider) Name() string {
	return "alipay"
}

// CreateCheckout creates an Alipay payment and returns a QR code or redirect URL.
// TODO: Implement when merchant account is ready.
// Implementation steps:
// 1. Initialize alipay.Client with app_id, private_key, etc.
// 2. Use alipay.TradePagePay for web payments (returns redirect URL)
// 3. Use alipay.TradePrecreate for QR code payments (returns qr_code)
// 4. Set notify_url for async callback
// 5. Include order_no in passback_params for callback identification
func (p *AlipayProvider) CreateCheckout(orderNo string, amountCents int, currency string, description string, successURL string, cancelURL string) (string, error) {
	if p.appID == "" {
		return "", ErrNotConfigured
	}

	// TODO: Implement Alipay checkout
	// Example implementation:
	//
	// client, err := alipay.New(p.appID, p.privateKey, false) // false = production
	// if err != nil {
	//     return "", fmt.Errorf("create alipay client: %w", err)
	// }
	// client.LoadAliPayPublicKey(alipayPublicKey)
	//
	// // Convert cents to yuan (元) - Alipay uses string amounts
	// amountYuan := fmt.Sprintf("%.2f", float64(amountCents)/100)
	//
	// pay := alipay.TradePagePay{}
	// pay.NotifyURL = notifyURL
	// pay.ReturnURL = successURL
	// pay.Subject = description
	// pay.OutTradeNo = orderNo
	// pay.TotalAmount = amountYuan
	// pay.ProductCode = "FAST_INSTANT_TRADE_PAY"
	//
	// url, err := client.TradePagePay(pay)
	// if err != nil {
	//     return "", fmt.Errorf("create alipay payment: %w", err)
	// }
	// return url.String(), nil

	return "", ErrNotConfigured
}

// VerifyWebhook verifies the Alipay callback signature.
// TODO: Implement when merchant account is ready.
// Implementation steps:
// 1. Parse the callback parameters
// 2. Use alipay.Client.VerifySign to verify the signature
func (p *AlipayProvider) VerifyWebhook(payload []byte, signature string) (bool, error) {
	if p.appID == "" {
		return false, ErrNotConfigured
	}

	// TODO: Implement Alipay signature verification
	// Example implementation:
	//
	// values, err := url.ParseQuery(string(payload))
	// if err != nil {
	//     return false, fmt.Errorf("parse callback params: %w", err)
	// }
	//
	// ok, err := client.VerifySign(values)
	// if err != nil {
	//     return false, fmt.Errorf("verify sign: %w", err)
	// }
	// return ok, nil

	return false, ErrNotConfigured
}

// ParseCallback parses the Alipay callback and extracts order information.
// TODO: Implement when merchant account is ready.
// Implementation steps:
// 1. Parse the callback parameters
// 2. Check trade_status == "TRADE_SUCCESS" or "TRADE_FINISHED"
// 3. Extract out_trade_no (order_no) and trade_no (external_id)
func (p *AlipayProvider) ParseCallback(payload []byte) (orderNo string, externalID string, err error) {
	if p.appID == "" {
		return "", "", ErrNotConfigured
	}

	// TODO: Implement Alipay callback parsing
	// Example implementation:
	//
	// values, err := url.ParseQuery(string(payload))
	// if err != nil {
	//     return "", "", fmt.Errorf("parse callback params: %w", err)
	// }
	//
	// // Check payment status
	// tradeStatus := values.Get("trade_status")
	// if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
	//     return "", "", fmt.Errorf("invalid trade status: %s", tradeStatus)
	// }
	//
	// orderNo = values.Get("out_trade_no")  // our order number
	// externalID = values.Get("trade_no")   // alipay transaction ID
	//
	// if orderNo == "" || externalID == "" {
	//     return "", "", fmt.Errorf("missing order_no or trade_no")
	// }
	//
	// return orderNo, externalID, nil

	return "", "", ErrNotConfigured
}
