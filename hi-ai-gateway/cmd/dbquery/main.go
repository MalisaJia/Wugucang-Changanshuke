package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	dsn := "postgres://neondb_owner:npg_wySpABGm8gr5@ep-round-heart-a1etiqaw-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require&channel_binding=require"

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect error: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	// Query all users
	rows, err := conn.Query(ctx, "SELECT id, email, display_name, role, tenant_id, created_at FROM users WHERE deleted_at IS NULL")
	if err != nil {
		fmt.Fprintf(os.Stderr, "query error: %v\n", err)
		os.Exit(1)
	}
	defer rows.Close()

	fmt.Println("=== All Users ===")
	fmt.Printf("%-36s | %-30s | %-15s | %-10s | %-36s | %s\n", "ID", "Email", "DisplayName", "Role", "TenantID", "CreatedAt")
	fmt.Println("---")
	for rows.Next() {
		var id, email, displayName, role, tenantID string
		var createdAt time.Time
		if err := rows.Scan(&id, &email, &displayName, &role, &tenantID, &createdAt); err != nil {
			fmt.Fprintf(os.Stderr, "scan error: %v\n", err)
			continue
		}
		fmt.Printf("%-36s | %-30s | %-15s | %-10s | %-36s | %s\n", id, email, displayName, role, tenantID, createdAt.Format(time.RFC3339))
	}
	if err := rows.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "rows error: %v\n", err)
		os.Exit(1)
	}
}
