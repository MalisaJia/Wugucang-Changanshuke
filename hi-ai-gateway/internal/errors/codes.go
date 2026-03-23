package errors

import "net/http"

// Error codes for the Hi AI gateway.
const (
	CodeBadRequest           = "bad_request"
	CodeUnauthorized         = "unauthorized"
	CodeForbidden            = "forbidden"
	CodeNotFound             = "not_found"
	CodeConflict             = "conflict"
	CodeRateLimited          = "rate_limited"
	CodeInternalError        = "internal_error"
	CodeProviderError        = "provider_error"
	CodeProviderTimeout      = "provider_timeout"
	CodeProviderUnavailable  = "provider_unavailable"
	CodeModelNotFound        = "model_not_found"
	CodeInvalidAPIKey        = "invalid_api_key"
	CodeExpiredAPIKey        = "expired_api_key"
	CodeGuardrailViolation   = "guardrail_violation"
	CodeCircuitOpen          = "circuit_open"
	CodeCacheError           = "cache_error"
	CodeValidationError      = "validation_error"
	CodeInsufficientBalance  = "insufficient_balance"
	CodeWeakPassword         = "weak_password"
)

// StatusCodeMap maps error codes to HTTP status codes.
var StatusCodeMap = map[string]int{
	CodeBadRequest:          http.StatusBadRequest,
	CodeUnauthorized:        http.StatusUnauthorized,
	CodeForbidden:           http.StatusForbidden,
	CodeNotFound:            http.StatusNotFound,
	CodeConflict:            http.StatusConflict,
	CodeRateLimited:         http.StatusTooManyRequests,
	CodeInternalError:       http.StatusInternalServerError,
	CodeProviderError:       http.StatusBadGateway,
	CodeProviderTimeout:     http.StatusGatewayTimeout,
	CodeProviderUnavailable: http.StatusServiceUnavailable,
	CodeModelNotFound:       http.StatusNotFound,
	CodeInvalidAPIKey:       http.StatusUnauthorized,
	CodeExpiredAPIKey:       http.StatusUnauthorized,
	CodeGuardrailViolation:  http.StatusBadRequest,
	CodeCircuitOpen:         http.StatusServiceUnavailable,
	CodeCacheError:          http.StatusInternalServerError,
	CodeValidationError:     http.StatusUnprocessableEntity,
	CodeInsufficientBalance: http.StatusPaymentRequired,
	CodeWeakPassword:        http.StatusBadRequest,
}

// ErrInsufficientBalance is returned when a tenant has insufficient token balance.
var ErrInsufficientBalance = &APIError{
	HTTPStatus: http.StatusPaymentRequired,
	Code:       CodeInsufficientBalance,
	Message:    "Insufficient token balance. Please recharge your account.",
	Type:       "billing_error",
}

// ErrWeakPassword is returned when a password does not meet complexity requirements.
var ErrWeakPassword = &APIError{
	HTTPStatus: http.StatusBadRequest,
	Code:       CodeWeakPassword,
	Message:    "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character.",
	Type:       "validation_error",
}
