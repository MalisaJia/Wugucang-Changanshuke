package handler

import "github.com/gofiber/fiber/v2"

// HealthHandler handles health check endpoints.
type HealthHandler struct{}

// NewHealthHandler creates a new health handler.
func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

// Liveness handles GET /healthz — indicates the process is running.
func (h *HealthHandler) Liveness(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status": "ok",
	})
}

// Readiness handles GET /readyz — indicates the service is ready to accept traffic.
func (h *HealthHandler) Readiness(c *fiber.Ctx) error {
	// In Phase 2, this will check DB/Redis/Milvus connectivity
	return c.JSON(fiber.Map{
		"status": "ready",
	})
}
