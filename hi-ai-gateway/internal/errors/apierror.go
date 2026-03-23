package errors

import (
	"fmt"
	"net/http"
)

// APIError is the standard error type returned by the gateway.
// It follows the OpenAI error response format for compatibility.
type APIError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	Type       string `json:"type,omitempty"`
	Param      string `json:"param,omitempty"`
	ProviderID string `json:"provider_id,omitempty"`
	HTTPStatus int    `json:"-"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// ErrorResponse is the JSON body returned to clients on error.
// Follows OpenAI's error format: {"error": {"message": ..., "type": ..., "code": ...}}
type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Param   string `json:"param,omitempty"`
	Code    string `json:"code"`
}

// New creates a new APIError with the given code and message.
func New(code, message string) *APIError {
	status, ok := StatusCodeMap[code]
	if !ok {
		status = http.StatusInternalServerError
	}
	return &APIError{
		Code:       code,
		Message:    message,
		Type:       code,
		HTTPStatus: status,
	}
}

// Newf creates a new APIError with a formatted message.
func Newf(code, format string, args ...interface{}) *APIError {
	return New(code, fmt.Sprintf(format, args...))
}

// Wrap wraps an existing error into an APIError.
func Wrap(code string, err error) *APIError {
	return New(code, err.Error())
}

// ToResponse converts an APIError to an ErrorResponse.
func (e *APIError) ToResponse() ErrorResponse {
	return ErrorResponse{
		Error: ErrorBody{
			Message: e.Message,
			Type:    e.Type,
			Code:    e.Code,
			Param:   e.Param,
		},
	}
}

// Common error constructors.

func BadRequest(message string) *APIError {
	return New(CodeBadRequest, message)
}

func Unauthorized(message string) *APIError {
	return New(CodeUnauthorized, message)
}

func Forbidden(message string) *APIError {
	return New(CodeForbidden, message)
}

func NotFound(message string) *APIError {
	return New(CodeNotFound, message)
}

func InternalError(message string) *APIError {
	return New(CodeInternalError, message)
}

func RateLimited(message string) *APIError {
	return New(CodeRateLimited, message)
}

func ProviderError(providerID, message string) *APIError {
	e := New(CodeProviderError, message)
	e.ProviderID = providerID
	return e
}

func ProviderTimeout(providerID string) *APIError {
	e := New(CodeProviderTimeout, fmt.Sprintf("provider %s timed out", providerID))
	e.ProviderID = providerID
	return e
}
