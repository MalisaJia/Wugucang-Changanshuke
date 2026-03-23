.PHONY: build run test lint clean dev docker-build docker-up docker-down

# Variables
APP_NAME := hi-ai-gateway
BUILD_DIR := ./bin
MAIN_PATH := ./cmd/gateway
CONFIG_PATH := ./configs/config.yaml

# Build the gateway binary
build:
	go build -o $(BUILD_DIR)/$(APP_NAME) $(MAIN_PATH)

# Run the gateway
run: build
	$(BUILD_DIR)/$(APP_NAME) -config $(CONFIG_PATH)

# Run in development mode with hot-reload (requires air)
dev:
	air -c .air.toml

# Run tests
test:
	go test ./... -v -race -cover

# Run linter
lint:
	golangci-lint run ./...

# Run go vet
vet:
	go vet ./...

# Format code
fmt:
	gofmt -w .
	goimports -w .

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)

# Tidy go modules
tidy:
	go mod tidy

# Docker build
docker-build:
	docker build -t $(APP_NAME):latest -f deployments/docker/Dockerfile .

# Docker compose up (full stack)
docker-up:
	docker-compose -f deployments/docker/docker-compose.yml up -d

# Docker compose down
docker-down:
	docker-compose -f deployments/docker/docker-compose.yml down

# Run database migrations
migrate-up:
	go run ./cmd/migrate -direction up

migrate-down:
	go run ./cmd/migrate -direction down

# Generate mocks
generate:
	go generate ./...

# All checks
check: fmt vet lint test
