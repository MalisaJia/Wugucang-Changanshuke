package admin

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"

	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/repository/postgres"
	"github.com/hi-ai/gateway/internal/service"
)

// ProfileHandler handles user profile endpoints.
type ProfileHandler struct {
	userRepo *postgres.UserRepository
	userSvc  *service.UserService
	logger   *slog.Logger
}

// NewProfileHandler creates a new profile handler.
func NewProfileHandler(userRepo *postgres.UserRepository, userSvc *service.UserService, logger *slog.Logger) *ProfileHandler {
	return &ProfileHandler{
		userRepo: userRepo,
		userSvc:  userSvc,
		logger:   logger,
	}
}

// ProfileResponse represents user profile info returned to clients.
type ProfileResponse struct {
	ID          string  `json:"id"`
	TenantID    string  `json:"tenant_id"`
	Email       string  `json:"email"`
	DisplayName string  `json:"display_name"`
	Role        string  `json:"role"`
	Status      string  `json:"status"`
	LastLoginAt *string `json:"last_login_at,omitempty"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

// UpdateProfileRequest is the request body for updating user profile.
type UpdateProfileRequest struct {
	DisplayName *string `json:"display_name,omitempty"`
	Email       *string `json:"email,omitempty"`
}

// ChangePasswordRequest is the request body for changing password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// Get handles GET /api/profile - Get current user profile.
func (h *ProfileHandler) Get(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	user, err := h.userRepo.GetByID(c.Context(), tc.UserID)
	if err != nil {
		h.logger.Error("failed to get user", "error", err, "user_id", tc.UserID)
		e := apierr.NotFound("user not found")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var lastLoginAt *string
	if user.LastLoginAt != nil {
		formatted := user.LastLoginAt.Format("2006-01-02T15:04:05Z")
		lastLoginAt = &formatted
	}

	return c.JSON(ProfileResponse{
		ID:          user.ID,
		TenantID:    user.TenantID,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Role:        string(user.Role),
		Status:      user.Status,
		LastLoginAt: lastLoginAt,
		CreatedAt:   user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:   user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// Update handles PUT /api/profile - Update user profile.
func (h *ProfileHandler) Update(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Get current user
	user, err := h.userRepo.GetByID(c.Context(), tc.UserID)
	if err != nil {
		h.logger.Error("failed to get user", "error", err, "user_id", tc.UserID)
		e := apierr.NotFound("user not found")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Apply updates
	if req.DisplayName != nil {
		user.DisplayName = *req.DisplayName
	}
	if req.Email != nil && *req.Email != "" {
		// Check if email is already in use by another user
		existingUser, err := h.userRepo.GetByEmailGlobal(c.Context(), *req.Email)
		if err == nil && existingUser.ID != user.ID {
			e := apierr.BadRequest("email already in use")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}
		user.Email = *req.Email
	}

	// Save updates
	if err := h.userRepo.Update(c.Context(), user); err != nil {
		h.logger.Error("failed to update user", "error", err, "user_id", tc.UserID)
		e := apierr.InternalError("failed to update profile")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("profile updated", "user_id", tc.UserID)

	var lastLoginAt *string
	if user.LastLoginAt != nil {
		formatted := user.LastLoginAt.Format("2006-01-02T15:04:05Z")
		lastLoginAt = &formatted
	}

	return c.JSON(ProfileResponse{
		ID:          user.ID,
		TenantID:    user.TenantID,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Role:        string(user.Role),
		Status:      user.Status,
		LastLoginAt: lastLoginAt,
		CreatedAt:   user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:   user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// ChangePassword handles PUT /api/profile/password - Change password.
func (h *ProfileHandler) ChangePassword(c *fiber.Ctx) error {
	tc := middleware.GetTenantContext(c)
	if tc == nil {
		e := apierr.Unauthorized("authentication required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	var req ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		e := apierr.BadRequest("invalid request body")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		e := apierr.New(apierr.CodeValidationError, "current_password and new_password are required")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	if len(req.NewPassword) < 8 {
		e := apierr.New(apierr.CodeValidationError, "new password must be at least 8 characters")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Get current user
	user, err := h.userRepo.GetByID(c.Context(), tc.UserID)
	if err != nil {
		h.logger.Error("failed to get user", "error", err, "user_id", tc.UserID)
		e := apierr.NotFound("user not found")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Verify current password
	if !h.userSvc.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		e := apierr.Unauthorized("current password is incorrect")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Hash new password
	newHash, err := h.userSvc.HashPassword(req.NewPassword)
	if err != nil {
		h.logger.Error("failed to hash password", "error", err, "user_id", tc.UserID)
		e := apierr.InternalError("failed to update password")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	// Update password
	user.PasswordHash = newHash
	if err := h.userRepo.Update(c.Context(), user); err != nil {
		h.logger.Error("failed to update user password", "error", err, "user_id", tc.UserID)
		e := apierr.InternalError("failed to update password")
		return c.Status(e.HTTPStatus).JSON(e.ToResponse())
	}

	h.logger.Info("password changed", "user_id", tc.UserID)

	return c.JSON(fiber.Map{
		"message": "password updated successfully",
	})
}
