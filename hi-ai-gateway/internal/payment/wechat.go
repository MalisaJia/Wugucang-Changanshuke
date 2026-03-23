package payment

// WechatProvider implements PaymentProvider for WeChat Pay.
// TODO: When merchant account is ready, implement using:
// - github.com/wechatpay-apiv3/wechatpay-go (official v3 SDK)
// - or github.com/go-pay/gopay (alternative)
//
// Required configuration:
// - app_id: 应用ID (公众号/小程序/APP)
// - mch_id: 商户号
// - api_key: API密钥 (v2) or API v3 密钥
// - serial_no: 证书序列号 (v3)
// - private_key: 商户私钥 (v3)
// - notify_url: 异步通知地址
type WechatProvider struct {
	appID  string
	mchID  string
	apiKey string
	// TODO: Add wechat pay client when implemented
	// client *wechat.Client
}

// NewWechatProvider creates a new WeChat Pay provider.
func NewWechatProvider(appID, mchID, apiKey string) *WechatProvider {
	return &WechatProvider{
		appID:  appID,
		mchID:  mchID,
		apiKey: apiKey,
	}
}

// Name returns the provider name.
func (p *WechatProvider) Name() string {
	return "wechat"
}

// CreateCheckout creates a WeChat payment and returns a QR code.
// TODO: Implement when merchant account is ready.
// Implementation steps:
// 1. Initialize WeChat Pay client with credentials
// 2. Use Native Pay API for QR code payments
// 3. Set notify_url for async callback
// 4. Include order_no in attach field for callback identification
func (p *WechatProvider) CreateCheckout(orderNo string, amountCents int, currency string, description string, successURL string, cancelURL string) (string, error) {
	if p.appID == "" || p.mchID == "" {
		return "", ErrNotConfigured
	}

	// TODO: Implement WeChat Pay checkout
	// Example implementation using wechatpay-go v3:
	//
	// ctx := context.Background()
	//
	// // Create payment request
	// req := &native.PrepayRequest{
	//     Appid:       core.String(p.appID),
	//     Mchid:       core.String(p.mchID),
	//     Description: core.String(description),
	//     OutTradeNo:  core.String(orderNo),
	//     NotifyUrl:   core.String(notifyURL),
	//     Amount: &native.Amount{
	//         Total:    core.Int64(int64(amountCents)),
	//         Currency: core.String("CNY"),
	//     },
	//     Attach: core.String(orderNo), // for callback identification
	// }
	//
	// resp, _, err := client.Prepay(ctx, req)
	// if err != nil {
	//     return "", fmt.Errorf("create wechat payment: %w", err)
	// }
	//
	// // Return the code_url for QR code generation
	// return *resp.CodeUrl, nil

	return "", ErrNotConfigured
}

// VerifyWebhook verifies the WeChat Pay callback signature.
// TODO: Implement when merchant account is ready.
// Implementation steps:
// 1. Get signature from Wechatpay-Signature header
// 2. Get timestamp from Wechatpay-Timestamp header
// 3. Get nonce from Wechatpay-Nonce header
// 4. Verify signature using platform certificate
func (p *WechatProvider) VerifyWebhook(payload []byte, signature string) (bool, error) {
	if p.appID == "" || p.mchID == "" {
		return false, ErrNotConfigured
	}

	// TODO: Implement WeChat Pay signature verification
	// Example implementation using wechatpay-go v3:
	//
	// verifier := verifiers.NewSHA256WithRSAVerifier(platformCertificate)
	//
	// err := verifier.Verify(ctx, serialNumber, message, signature)
	// if err != nil {
	//     return false, fmt.Errorf("verify signature: %w", err)
	// }
	// return true, nil

	return false, ErrNotConfigured
}

// ParseCallback parses the WeChat Pay callback and extracts order information.
// TODO: Implement when merchant account is ready.
// Implementation steps:
// 1. Decrypt the callback resource using API v3 key
// 2. Parse the decrypted JSON
// 3. Check trade_state == "SUCCESS"
// 4. Extract out_trade_no (order_no) and transaction_id (external_id)
func (p *WechatProvider) ParseCallback(payload []byte) (orderNo string, externalID string, err error) {
	if p.appID == "" || p.mchID == "" {
		return "", "", ErrNotConfigured
	}

	// TODO: Implement WeChat Pay callback parsing
	// Example implementation:
	//
	// // Parse the encrypted notification
	// var notification struct {
	//     Resource struct {
	//         Algorithm      string `json:"algorithm"`
	//         Ciphertext     string `json:"ciphertext"`
	//         AssociatedData string `json:"associated_data"`
	//         Nonce          string `json:"nonce"`
	//     } `json:"resource"`
	// }
	//
	// if err := json.Unmarshal(payload, &notification); err != nil {
	//     return "", "", fmt.Errorf("parse notification: %w", err)
	// }
	//
	// // Decrypt the resource
	// decrypted, err := utils.DecryptAES256GCM(
	//     p.apiKey,
	//     notification.Resource.AssociatedData,
	//     notification.Resource.Nonce,
	//     notification.Resource.Ciphertext,
	// )
	// if err != nil {
	//     return "", "", fmt.Errorf("decrypt resource: %w", err)
	// }
	//
	// // Parse the decrypted payment result
	// var result struct {
	//     OutTradeNo    string `json:"out_trade_no"`
	//     TransactionID string `json:"transaction_id"`
	//     TradeState    string `json:"trade_state"`
	// }
	//
	// if err := json.Unmarshal(decrypted, &result); err != nil {
	//     return "", "", fmt.Errorf("parse payment result: %w", err)
	// }
	//
	// if result.TradeState != "SUCCESS" {
	//     return "", "", fmt.Errorf("invalid trade state: %s", result.TradeState)
	// }
	//
	// return result.OutTradeNo, result.TransactionID, nil

	return "", "", ErrNotConfigured
}
