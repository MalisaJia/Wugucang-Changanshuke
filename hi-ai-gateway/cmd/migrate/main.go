package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/hi-ai/gateway/internal/config"
	"github.com/jackc/pgx/v5"
)

func main() {
	fmt.Println("=== Hi AI Gateway Migration Runner ===")
	fmt.Println()

	// Load configuration
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	dsn := cfg.Database.DSN()
	fmt.Printf("Connecting to database: %s@%s:%d/%s\n",
		cfg.Database.User, cfg.Database.Host, cfg.Database.Port, cfg.Database.DBName)

	// Connect to database
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fmt.Printf("Failed to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	fmt.Println("Connected to database successfully!")
	fmt.Println()

	// Create schema_migrations table if not exists
	if err := createMigrationsTable(ctx, conn); err != nil {
		fmt.Printf("Failed to create migrations table: %v\n", err)
		os.Exit(1)
	}

	// Get list of applied migrations
	applied, err := getAppliedMigrations(ctx, conn)
	if err != nil {
		fmt.Printf("Failed to get applied migrations: %v\n", err)
		os.Exit(1)
	}

	// Read migration files
	migrations, err := getMigrationFiles("migrations")
	if err != nil {
		fmt.Printf("Failed to read migration files: %v\n", err)
		os.Exit(1)
	}

	if len(migrations) == 0 {
		fmt.Println("No migration files found.")
		return
	}

	fmt.Printf("Found %d migration files\n", len(migrations))
	fmt.Println()

	// Execute pending migrations
	appliedCount := 0
	for _, migration := range migrations {
		if applied[migration] {
			fmt.Printf("SKIP: %s (already applied)\n", migration)
			continue
		}

		fmt.Printf("APPLY: %s ... ", migration)

		if err := applyMigration(ctx, conn, migration); err != nil {
			fmt.Printf("FAILED\n")
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("OK\n")
		appliedCount++
	}

	fmt.Println()
	if appliedCount == 0 {
		fmt.Println("All migrations are already applied. Database is up to date!")
	} else {
		fmt.Printf("Successfully applied %d migration(s).\n", appliedCount)
	}
}

func createMigrationsTable(ctx context.Context, conn *pgx.Conn) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`
	_, err := conn.Exec(ctx, query)
	return err
}

func getAppliedMigrations(ctx context.Context, conn *pgx.Conn) (map[string]bool, error) {
	applied := make(map[string]bool)

	rows, err := conn.Query(ctx, "SELECT filename FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			return nil, err
		}
		applied[filename] = true
	}

	return applied, rows.Err()
}

func getMigrationFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var migrations []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".up.sql") {
			migrations = append(migrations, name)
		}
	}

	sort.Strings(migrations)
	return migrations, nil
}

func applyMigration(ctx context.Context, conn *pgx.Conn, filename string) error {
	// Read migration file
	content, err := os.ReadFile(filepath.Join("migrations", filename))
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	// Execute migration in a transaction
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Execute migration SQL
	if _, err := tx.Exec(ctx, string(content)); err != nil {
		return fmt.Errorf("execute migration: %w", err)
	}

	// Record migration as applied
	_, err = tx.Exec(ctx, "INSERT INTO schema_migrations (filename) VALUES ($1)", filename)
	if err != nil {
		return fmt.Errorf("record migration: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}
