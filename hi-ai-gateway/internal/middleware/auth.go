package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	apierr "github.com/hi-ai/gateway/internal/errors"
)

// TenantContext holds the authenticated tenant and user information.
type TenantContext struct {
	TenantID     string
	UserID       string
	KeyID        string
	Role         string
	Email        string
	RateLimitRPM int // Rate limit in requests per minute (from tenant or key)
	RateLimitTPM int // Rate limit in tokens per minute (from tenant or key)
}

// GetTenantContext retrieves the tenant context from Fiber locals.
func GetTenantContext(c *fiber.Ctx) *TenantContext {
	tc, ok := c.Locals("tenant_ctx").(*TenantContext)
	if !ok {
		return nil
	}
	return tc
}

// APIKeyLookupFunc is the function signature for API key lookups.
type APIKeyLookupFunc func(ctx context.Context, hash string) (*TenantContext, error)

// APIKeyAuth authenticates requests using virtual API keys (for /v1/* endpoints).
// Keys are in the format: "Authorization: Bearer hiai-xxxxx"
func APIKeyAuth(keyLookup APIKeyLookupFunc) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if auth == "" {
			e := apierr.Unauthorized("missing Authorization header")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}

		token := strings.TrimPrefix(auth, "Bearer ")
		if token == auth {
			e := apierr.Unauthorized("invalid Authorization format, expected 'Bearer <key>'")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}

		if !strings.HasPrefix(token, "hiai-") {
			e := apierr.Unauthorized("invalid API key format")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}

		// Hash the key for lookup
		hash := sha256.Sum256([]byte(token))
		keyHash := hex.EncodeToString(hash[:])

		tc, err := keyLookup(c.Context(), keyHash)
		if err != nil {
			e := apierr.Unauthorized("invalid or expired API key")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}

		c.Locals("tenant_ctx", tc)
		return c.Next()
	}
}

// JWTClaims holds the claims for JWT tokens.
type JWTClaims struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// JWTAuth authenticates requests using JWT tokens (for /api/* management endpoints).
func JWTAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if auth == "" {
			e := apierr.Unauthorized("missing Authorization header")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}

		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		if tokenStr == auth {
			e := apierr.Unauthorized("invalid Authorization format")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}

		claims := &JWTClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			e := apierr.Unauthorized("invalid or expired token")
			return c.Status(e.HTTPStatus).JSON(e.ToResponse())
		}

		c.Locals("tenant_ctx", &TenantContext{
			TenantID: claims.TenantID,
			UserID:   claims.UserID,
			Role:     claims.Role,
			Email:    claims.Email,
		})
		return c.Next()
	}
}

// GenerateJWT creates a new JWT access token.
func GenerateJWT(secret string, claims *JWTClaims, ttlSeconds int) (string, error) {
	claims.RegisteredClaims = jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(ttlSeconds) * time.Second)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Issuer:    "hi-ai",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// RefreshTokenClaims holds the claims for refresh tokens.
type RefreshTokenClaims struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	Type     string `json:"type"` // "refresh" to distinguish from access tokens
	jwt.RegisteredClaims
}

// GenerateRefreshToken creates a new refresh token with longer TTL.
func GenerateRefreshToken(secret string, userID, tenantID string, ttlSeconds int) (string, error) {
	claims := &RefreshTokenClaims{
		UserID:   userID,
		TenantID: tenantID,
		Type:     "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(ttlSeconds) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "hi-ai",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateRefreshToken validates a refresh token and returns the claims.
func ValidateRefreshToken(tokenStr, secret string) (*RefreshTokenClaims, error) {
	claims := &RefreshTokenClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		return nil, err
	}

	// Verify this is a refresh token
	if claims.Type != "refresh" {
		return nil, jwt.ErrTokenInvalidClaims
	}

	return claims, nil
}
