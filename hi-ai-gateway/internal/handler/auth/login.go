package auth

import (
	"regexp"

	"github.com/gofiber/fiber/v2"

	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/service"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	userSvc   *service.UserService
	jwtSecret string
}

// NewAuthHandler creates a new auth handler.
func NewAuthHandler(userSvc *service.UserService, jwtSecret string) *AuthHandler {
	return &AuthHandler{userSvc: userSvc, jwtSecret: jwtSecret}
}

// emailRegex is a simple email validation pattern.
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// Register handles POST /api/auth/register
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req service.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" {
		e := apierr.New(apierr.CodeValidationError, "email and password are required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate email format
	if !emailRegex.MatchString(req.Email) {
		e := apierr.New(apierr.CodeValidationError, "invalid email format")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate password length
	if len(req.Password) < 8 {
		e := apierr.New(apierr.CodeValidationError, "password must be at least 8 characters")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Call UserService.Register
	authResp, err := h.userSvc.Register(c.Context(), req)
	if err != nil {
		if apiErr, ok := err.(*apierr.APIError); ok {
			return c.Status(apiErr.HTTPStatus).JSON(apiErr.ToResponse())
		}
		e := apierr.InternalError("registration failed")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	return c.Status(fiber.StatusCreated).JSON(authResp)
}

// Login handles POST /api/auth/login
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req service.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" {
		e := apierr.New(apierr.CodeValidationError, "email and password are required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Call UserService.Login
	authResp, err := h.userSvc.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		if apiErr, ok := err.(*apierr.APIError); ok {
			return c.Status(apiErr.HTTPStatus).JSON(apiErr.ToResponse())
		}
		e := apierr.Unauthorized("invalid email or password")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	return c.Status(fiber.StatusOK).JSON(authResp)
}

// RefreshRequest holds the refresh token.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Refresh handles POST /api/auth/refresh - refreshes access token using refresh token.
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if req.RefreshToken == "" {
		e := apierr.BadRequest("refresh_token is required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Validate the refresh token
	claims, err := middleware.ValidateRefreshToken(req.RefreshToken, h.jwtSecret)
	if err != nil {
		e := apierr.Unauthorized("invalid or expired refresh token")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Get user by ID to refresh tokens
	authResp, err := h.userSvc.RefreshTokens(c.Context(), claims.UserID)
	if err != nil {
		if apiErr, ok := err.(*apierr.APIError); ok {
			return c.Status(apiErr.HTTPStatus).JSON(apiErr.ToResponse())
		}
		e := apierr.Unauthorized("failed to refresh tokens")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	return c.Status(fiber.StatusOK).JSON(authResp)
}
