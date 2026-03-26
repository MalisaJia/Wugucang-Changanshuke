package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hi-ai/gateway/internal/app"
	"github.com/hi-ai/gateway/internal/config"
)

const (
	// Fix: Add forced shutdown timeout to prevent process hanging forever
	gracefulShutdownTimeout = 30 * time.Second
	forcedShutdownTimeout   = 5 * time.Second
)

func main() {
	configPath := flag.String("config", "configs/config.yaml", "path to configuration file")
	flag.Parse()

	// Fix: Add panic recovery wrapper around entire main function
	defer func() {
		if r := recover(); r != nil {
			log.Printf("FATAL: panic in main: %v", r)
			os.Exit(1)
		}
	}()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Create application with panic recovery
	var application *app.App
	func() {
		defer func() {
			if r := recover(); r != nil {
				log.Fatalf("FATAL: panic creating application: %v", r)
			}
		}()
		application, err = app.New(cfg)
	}()
	if err != nil {
		log.Fatalf("failed to create application: %v", err)
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		// Fix: Add panic recovery wrapper around app.Run()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("FATAL: panic in server: %v", r)
				quit <- syscall.SIGTERM
			}
		}()
		if err := application.Run(); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down gracefully...")

	// Fix: Create context with timeout for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), gracefulShutdownTimeout)
	defer cancel()

	// Channel to signal shutdown completion
	done := make(chan struct{})

	go func() {
		if err := application.Shutdown(ctx); err != nil {
			log.Printf("shutdown error: %v", err)
		}
		close(done)
	}()

	// Wait for shutdown to complete or timeout
	select {
	case <-done:
		log.Println("graceful shutdown completed")
	case <-ctx.Done():
		log.Println("graceful shutdown timed out, forcing exit...")
		// Give a short grace period for cleanup
		time.Sleep(forcedShutdownTimeout)
		log.Println("forced shutdown complete")
	}
}
