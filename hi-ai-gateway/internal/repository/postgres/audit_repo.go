package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// AuditLog represents an audit log entry.
type AuditLog struct {
	ID             string                 `json:"id"`
	TenantID       string                 `json:"tenant_id"`
	UserID         *string                `json:"user_id,omitempty"`
	Action         string                 `json:"action"`
	ResourceType   string                 `json:"resource_type"`
	ResourceID     string                 `json:"resource_id,omitempty"`
	IPAddress      string                 `json:"ip_address,omitempty"`
	RequestSummary map[string]interface{} `json:"request_summary,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	// Computed fields for frontend display (populated from RequestSummary)
	ActionType string `json:"action_type,omitempty"`
	Detail     string `json:"detail,omitempty"`
}

// AuditRepository handles audit log persistence operations.
type AuditRepository struct {
	db *DB
}

// NewAuditRepository creates a new AuditRepository.
func NewAuditRepository(db *DB) *AuditRepository {
	return &AuditRepository{db: db}
}

// Insert creates a new audit log entry.
func (r *AuditRepository) Insert(ctx context.Context, log *AuditLog) error {
	var requestSummaryJSON []byte
	var err error

	if log.RequestSummary != nil {
		requestSummaryJSON, err = json.Marshal(log.RequestSummary)
		if err != nil {
			return fmt.Errorf("marshal request summary: %w", err)
		}
	}

	query := `
		INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, ip_address, request_summary, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`

	// Handle empty IP address - PostgreSQL INET doesn't accept empty strings
	var ipAddr interface{}
	if log.IPAddress != "" {
		ipAddr = log.IPAddress
	}

	err = r.db.pool.QueryRow(ctx, query,
		log.TenantID,
		log.UserID,
		log.Action,
		log.ResourceType,
		log.ResourceID,
		ipAddr,
		requestSummaryJSON,
		log.CreatedAt,
	).Scan(&log.ID)
	if err != nil {
		return fmt.Errorf("insert audit log: %w", err)
	}

	return nil
}

// ListByTenantID retrieves audit logs for a tenant with pagination.
// Returns (logs, totalCount, error).
func (r *AuditRepository) ListByTenantID(ctx context.Context, tenantID string, limit, offset int) ([]*AuditLog, int, error) {
	// Get total count
	countQuery := `SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1`
	var totalCount int
	err := r.db.pool.QueryRow(ctx, countQuery, tenantID).Scan(&totalCount)
	if err != nil {
		return nil, 0, fmt.Errorf("count audit logs: %w", err)
	}

	// Get paginated results
	query := `
		SELECT id, tenant_id, user_id, action, resource_type, resource_id, ip_address::text, request_summary, created_at
		FROM audit_logs
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.pool.Query(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []*AuditLog
	for rows.Next() {
		log, err := r.scanAuditLogFromRow(rows)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate audit logs: %w", err)
	}

	return logs, totalCount, nil
}

// scanAuditLogFromRow scans an audit log from an existing row iterator.
func (r *AuditRepository) scanAuditLogFromRow(rows pgx.Rows) (*AuditLog, error) {
	var log AuditLog
	var requestSummaryJSON []byte
	var ipAddress *string
	var resourceID *string

	err := rows.Scan(
		&log.ID,
		&log.TenantID,
		&log.UserID,
		&log.Action,
		&log.ResourceType,
		&resourceID,
		&ipAddress,
		&requestSummaryJSON,
		&log.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan audit log row: %w", err)
	}

	if resourceID != nil {
		log.ResourceID = *resourceID
	}

	if ipAddress != nil {
		log.IPAddress = *ipAddress
	}

	if len(requestSummaryJSON) > 0 {
		if err := json.Unmarshal(requestSummaryJSON, &log.RequestSummary); err != nil {
			return nil, fmt.Errorf("unmarshal request summary: %w", err)
		}
	}

	// Populate computed fields from RequestSummary
	log.populateComputedFields()

	return &log, nil
}

// populateComputedFields extracts ActionType and Detail from RequestSummary.
// For older logs without these fields, it generates them from Action and ResourceType.
func (log *AuditLog) populateComputedFields() {
	if log.RequestSummary != nil {
		// Try to get action_type from RequestSummary
		if actionType, ok := log.RequestSummary["action_type"].(string); ok && actionType != "" {
			log.ActionType = actionType
		}
		// Try to get detail from RequestSummary
		if detail, ok := log.RequestSummary["detail"].(string); ok {
			log.Detail = detail
		}
	}

	// If ActionType is still empty, generate it from Action and ResourceType
	if log.ActionType == "" {
		log.ActionType = generateActionType(log.Action, log.ResourceType)
	}

	// If Detail is still empty for certain action types, provide a default
	if log.Detail == "" {
		log.Detail = generateDefaultDetail(log.ActionType, log.ResourceType, log.ResourceID)
	}
}

// generateActionType creates a human-readable action type from action and resource type.
func generateActionType(action, resourceType string) string {
	switch resourceType {
	case "api_key":
		switch action {
		case "create":
			return "api_key_create"
		case "revoke", "delete":
			return "api_key_revoke"
		case "update":
			return "api_key_update"
		}
	case "provider_config":
		switch action {
		case "create":
			return "provider_create"
		case "update":
			return "provider_update"
		case "delete":
			return "provider_delete"
		}
	case "user":
		switch action {
		case "login":
			return "user_login"
		case "register":
			return "user_register"
		}
	case "user_profile":
		switch action {
		case "update":
			return "profile_update"
		case "change_password":
			return "password_change"
		}
	case "chat_completion":
		return "chat_completion"
	case "tenant":
		switch action {
		case "create":
			return "tenant_create"
		case "update":
			return "tenant_update"
		}
	}
	// Default: combine action and resource_type
	if resourceType != "" && resourceType != "unknown" {
		return action + "_" + resourceType
	}
	return action
}

// generateDefaultDetail provides a default detail message for certain action types.
func generateDefaultDetail(actionType, resourceType, resourceID string) string {
	switch actionType {
	case "api_key_create":
		return "创建了新的 API Key"
	case "api_key_revoke":
		return "撤销了 API Key"
	case "user_login":
		return "用户登录"
	case "user_register":
		return "用户注册"
	case "profile_update":
		return "更新了个人资料"
	case "password_change":
		return "修改了密码"
	case "billing_recharge":
		return "账户充值"
	case "tenant_create":
		return "创建了租户"
	case "tenant_update":
		return "更新了租户设置"
	case "provider_create", "provider_update", "provider_delete":
		if resourceID != "" {
			return "provider: " + resourceID
		}
	}
	return ""
}
