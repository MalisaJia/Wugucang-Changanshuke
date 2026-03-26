package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/hi-ai/gateway/internal/domain"
	apierr "github.com/hi-ai/gateway/internal/errors"
	"github.com/hi-ai/gateway/internal/middleware"
	"github.com/hi-ai/gateway/internal/repository/postgres"
)

// UserService manages user authentication and registration.
type UserService struct {
	userRepo        *postgres.UserRepository
	tenantRepo      *postgres.TenantRepository
	billingSvc      *BillingService
	jwtSecret       string
	accessTokenTTL  int
	refreshTokenTTL int
}

// NewUserService creates a new user service.
func NewUserService(userRepo *postgres.UserRepository, tenantRepo *postgres.TenantRepository, jwtSecret string, accessTTL, refreshTTL int, billingSvc *BillingService) *UserService {
	return &UserService{
		userRepo:        userRepo,
		tenantRepo:      tenantRepo,
		billingSvc:      billingSvc,
		jwtSecret:       jwtSecret,
		accessTokenTTL:  accessTTL,
		refreshTokenTTL: refreshTTL,
	}
}

// RegisterRequest holds registration data.
type RegisterRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
	TenantName  string `json:"tenant_name"`
}

// LoginRequest holds login data.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthResponse holds the authentication tokens.
type AuthResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	ExpiresIn    int         `json:"expires_in"`
	TokenType    string      `json:"token_type"`
	User         domain.User `json:"user"`
}

// HashPassword hashes a password using bcrypt.
func (s *UserService) HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// CheckPassword verifies a password against a hash.
func (s *UserService) CheckPassword(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// validatePassword checks if a password meets complexity requirements.
// Requirements:
// - At least 8 characters
// - At least 1 uppercase letter
// - At least 1 lowercase letter
// - At least 1 digit
// - At least 1 special character (!@#$%^&*()_+-=[]{}|;':",./<>?)
// - Does not contain the email prefix
func (s *UserService) validatePassword(password, email string) error {
	if len(password) < 8 {
		return apierr.ErrWeakPassword
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	specialChars := "!@#$%^&*()_+-=[]{}|;':\",./<>?"

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case strings.ContainsRune(specialChars, char):
			hasSpecial = true
		}
	}

	if !hasUpper || !hasLower || !hasDigit || !hasSpecial {
		return apierr.ErrWeakPassword
	}

	// Check if password contains email prefix
	if email != "" {
		emailPrefix := strings.Split(email, "@")[0]
		if len(emailPrefix) >= 3 && strings.Contains(strings.ToLower(password), strings.ToLower(emailPrefix)) {
			return apierr.New(apierr.CodeWeakPassword, "Password cannot contain your email username")
		}
	}

	return nil
}

// GenerateTokens creates access and refresh JWT tokens.
func (s *UserService) GenerateTokens(user *domain.User) (*AuthResponse, error) {
	accessClaims := &middleware.JWTClaims{
		UserID:          user.ID,
		TenantID:        user.TenantID,
		Email:           user.Email,
		Role:            string(user.Role),
		IsPlatformAdmin: user.IsPlatformAdmin,
	}

	accessToken, err := middleware.GenerateJWT(s.jwtSecret, accessClaims, s.accessTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	refreshClaims := &middleware.JWTClaims{
		UserID:   user.ID,
		TenantID: user.TenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.refreshTokenTTL) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "hi-ai",
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenStr, err := refreshToken.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshTokenStr,
		ExpiresIn:    s.accessTokenTTL,
		TokenType:    "Bearer",
		User:         *user,
	}, nil
}

// Login authenticates a user by email and password.
func (s *UserService) Login(ctx context.Context, email, password string) (*AuthResponse, error) {
	// Look up user by email
	user, err := s.userRepo.GetByEmailGlobal(ctx, email)
	if err != nil {
		return nil, apierr.Unauthorized("invalid email or password")
	}

	// Check user status
	if user.Status != "active" {
		return nil, apierr.Unauthorized("account is not active")
	}

	// Verify password
	if !s.CheckPassword(password, user.PasswordHash) {
		return nil, apierr.Unauthorized("invalid email or password")
	}

	// Update last login timestamp (best-effort, don't fail if this fails)
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	// Generate tokens
	authResp, err := s.GenerateTokens(user)
	if err != nil {
		return nil, apierr.InternalError("failed to generate tokens")
	}

	return authResp, nil
}

// Register creates a new tenant and user.
func (s *UserService) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	// Validate password complexity
	if err := s.validatePassword(req.Password, req.Email); err != nil {
		return nil, err
	}

	// Check if email already exists
	_, err := s.userRepo.GetByEmailGlobal(ctx, req.Email)
	if err == nil {
		return nil, apierr.BadRequest("email already registered")
	}

	// Hash password
	passwordHash, err := s.HashPassword(req.Password)
	if err != nil {
		return nil, apierr.InternalError("failed to process registration")
	}

	// Generate IDs
	tenantID := uuid.New().String()
	userID := uuid.New().String()

	// Determine tenant name
	tenantName := req.TenantName
	if tenantName == "" {
		tenantName = req.Email + "'s Team"
	}

	// Create tenant
	now := time.Now()
	tenant := &domain.Tenant{
		ID:           tenantID,
		Name:         tenantName,
		Slug:         slugify(tenantName),
		Plan:         domain.PlanFree,
		Status:       domain.TenantStatusActive,
		Settings:     make(domain.JSONMap),
		RateLimitRPM: 60,  // Default rate limit
		RateLimitTPM: 100000,
		MaxKeys:      5,   // Default max keys for free plan
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.tenantRepo.Create(ctx, tenant); err != nil {
		return nil, apierr.InternalError("failed to create tenant")
	}

	// Create user with Owner role
	user := &domain.User{
		ID:           userID,
		TenantID:     tenantID,
		Email:        req.Email,
		PasswordHash: passwordHash,
		DisplayName:  req.DisplayName,
		Role:         domain.RoleOwner,
		Status:       "active",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, apierr.InternalError("failed to create user")
	}

	// Initialize billing balance for new tenant (free plan gets 100K tokens)
	if s.billingSvc != nil {
		tenantUUID, err := uuid.Parse(tenantID)
		if err == nil {
			// Ensure balance record exists
			if err := s.billingSvc.EnsureBalance(ctx, tenantUUID); err != nil {
				// Log but don't fail registration
				_ = err
			}
			// For free plan, credit initial 100K tokens
			if tenant.Plan == domain.PlanFree {
				const freeTokens int64 = 100000 // 100K tokens for free plan
				if err := s.billingSvc.Recharge(ctx, tenantUUID, freeTokens, uuid.Nil, "Free plan initial credit"); err != nil {
					// Log but don't fail registration
					_ = err
				}
			}
		}
	}

	// Generate tokens
	authResp, err := s.GenerateTokens(user)
	if err != nil {
		return nil, apierr.InternalError("failed to generate tokens")
	}

	return authResp, nil
}

// RefreshTokens generates new access and refresh tokens for a user by ID.
func (s *UserService) RefreshTokens(ctx context.Context, userID string) (*AuthResponse, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, apierr.Unauthorized("user not found")
	}

	// Check user status
	if user.Status != "active" {
		return nil, apierr.Unauthorized("account is not active")
	}

	// Generate new tokens
	authResp, err := s.GenerateTokens(user)
	if err != nil {
		return nil, apierr.InternalError("failed to generate tokens")
	}

	return authResp, nil
}

// slugify converts a string to a URL-friendly slug.
func slugify(s string) string {
	// Convert to lowercase
	s = strings.ToLower(s)
	// Replace spaces with hyphens
	s = strings.ReplaceAll(s, " ", "-")
	// Remove non-alphanumeric characters except hyphens
	reg := regexp.MustCompile(`[^a-z0-9\-]`)
	s = reg.ReplaceAllString(s, "")
	// Remove multiple consecutive hyphens
	reg = regexp.MustCompile(`-+`)
	s = reg.ReplaceAllString(s, "-")
	// Trim leading/trailing hyphens
	s = strings.Trim(s, "-")
	// Ensure it's not empty
	if s == "" {
		s = "team-" + uuid.New().String()[:8]
	}
	return s
}
