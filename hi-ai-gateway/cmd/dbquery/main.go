package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	dsn := "postgres://neondb_owner:npg_wySpABGm8gr5@ep-round-heart-a1etiqaw-pooler.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require&channel_binding=require"

	newPassword := "Test@1234"
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintf(os.Stderr, "bcrypt error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Generated hash for '%s': %s\n", newPassword, string(hash))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect error: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	// Reset password for user
	email := "1615627276@qq.com"
	tag, err := conn.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE email = $2", string(hash), email)
	if err != nil {
		fmt.Fprintf(os.Stderr, "update error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Password reset for %s: %d row(s) updated\n", email, tag.RowsAffected())
}
