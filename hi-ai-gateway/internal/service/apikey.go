package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/hi-ai/gateway/internal/domain"
)

// APIKeyService manages virtual API keys.
type APIKeyService struct{}

// NewAPIKeyService creates a new API key service.
func NewAPIKeyService() *APIKeyService {
	return &APIKeyService{}
}

// GenerateKey generates a new virtual API key.
// Returns the full key (shown once) and the key struct for storage.
func (s *APIKeyService) GenerateKey(tenantID, createdBy, name string) (string, *domain.APIKey, error) {
	// Generate 32 random bytes
	rawKey := make([]byte, 32)
	if _, err := rand.Read(rawKey); err != nil {
		return "", nil, fmt.Errorf("generate random key: %w", err)
	}

	fullKey := domain.APIKeyPrefix + hex.EncodeToString(rawKey)
	prefix := fullKey[:12]

	// Hash the key for storage
	hash := sha256.Sum256([]byte(fullKey))
	keyHash := hex.EncodeToString(hash[:])

	now := time.Now()
	key := &domain.APIKey{
		TenantID:  tenantID,
		CreatedBy: &createdBy,
		Name:      name,
		KeyPrefix: prefix,
		KeyHash:   keyHash,
		Status:    domain.APIKeyStatusActive,
		CreatedAt: now,
		UpdatedAt: now,
	}

	return fullKey, key, nil
}

// HashKey computes the SHA-256 hash of an API key.
func (s *APIKeyService) HashKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}
