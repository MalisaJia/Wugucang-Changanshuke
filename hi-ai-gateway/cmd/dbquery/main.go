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

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect error: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	rows, err := conn.Query(ctx, "SELECT id, email, display_name, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 10")
	if err != nil {
		fmt.Fprintf(os.Stderr, "query error: %v\n", err)
		os.Exit(1)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, email, role, status string
		var displayName *string
		var createdAt time.Time
		if err := rows.Scan(&id, &email, &displayName, &role, &status, &createdAt); err != nil {
			fmt.Fprintf(os.Stderr, "scan error: %v\n", err)
			continue
		}
		name := "<nil>"
		if displayName != nil {
			name = *displayName
		}
		fmt.Printf("User #%d:\n  ID:      %s\n  Email:   %s\n  Name:    %s\n  Role:    %s\n  Status:  %s\n  Created: %s\n\n",
			count+1, id, email, name, role, status, createdAt.Format("2006-01-02 15:04:05"))
		count++
	}

	if count == 0 {
		fmt.Println("No users found in the database.")
	} else {
		fmt.Printf("Total: %d user(s)\n", count)
	}
}
