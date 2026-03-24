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

	// Fix usage_logs foreign key constraint to allow NULL api_key_id
	fmt.Println("Applying migration: allow api_key_id to be NULL...")

	migrationSQL := `
		ALTER TABLE usage_logs ALTER COLUMN api_key_id DROP NOT NULL;
		ALTER TABLE usage_logs DROP CONSTRAINT IF EXISTS usage_logs_api_key_id_fkey;
		ALTER TABLE usage_logs ADD CONSTRAINT usage_logs_api_key_id_fkey 
		  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL;
	`

	_, err = conn.Exec(ctx, migrationSQL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "migration error: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Migration applied successfully!")

	// Verify the change
	fmt.Println("\nVerifying usage_logs schema...")
	rows, err := conn.Query(ctx, `
		SELECT column_name, is_nullable, data_type 
		FROM information_schema.columns 
		WHERE table_name = 'usage_logs' AND column_name = 'api_key_id'
	`)
	if err != nil {
		fmt.Fprintf(os.Stderr, "query error: %v\n", err)
		os.Exit(1)
	}
	for rows.Next() {
		var colName, isNullable, dataType string
		rows.Scan(&colName, &isNullable, &dataType)
		fmt.Printf("Column: %s, Nullable: %s, Type: %s\n", colName, isNullable, dataType)
	}
	rows.Close()

	// Query usage stats
	fmt.Println("\nUsage logs by model:")
	rows2, _ := conn.Query(ctx, `SELECT model, COUNT(*), COALESCE(SUM(tokens_in),0), COALESCE(SUM(tokens_out),0) FROM usage_logs GROUP BY model`)
	for rows2.Next() {
		var model string
		var count, tokensIn, tokensOut int64
		rows2.Scan(&model, &count, &tokensIn, &tokensOut)
		fmt.Printf("Model: %s, Count: %d, TokensIn: %d, TokensOut: %d\n", model, count, tokensIn, tokensOut)
	}
	rows2.Close()
}
