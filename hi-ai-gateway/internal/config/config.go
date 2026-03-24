package config

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config holds all configuration for the Hi AI gateway.
type Config struct {
	Server    ServerConfig     `yaml:"server"`
	Database  DatabaseConfig   `yaml:"database"`
	Redis     RedisConfig      `yaml:"redis"`
	Auth      AuthConfig       `yaml:"auth"`
	Providers []ProviderConfig `yaml:"providers"`
	Routing   RoutingConfig    `yaml:"routing"`
	RateLimit RateLimitConfig  `yaml:"rate_limit"`
	Metrics   MetricsConfig    `yaml:"metrics"`
	Log       LogConfig        `yaml:"log"`
	Payment   PaymentConfig    `yaml:"payment"`
}

type ServerConfig struct {
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	ReadTimeout  int    `yaml:"read_timeout"`
	WriteTimeout int    `yaml:"write_timeout"`
	IdleTimeout  int    `yaml:"idle_timeout"`
}

type DatabaseConfig struct {
	Host        string `yaml:"host"`
	Port        int    `yaml:"port"`
	User        string `yaml:"user"`
	Password    string `yaml:"password"`
	DBName      string `yaml:"dbname"`
	SSLMode     string `yaml:"sslmode"`
	ExtraParams string `yaml:"extra_params"`
	MaxConns    int    `yaml:"max_conns"`
	MinConns    int    `yaml:"min_conns"`
}

func (d DatabaseConfig) DSN() string {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.DBName, d.SSLMode,
	)
	if d.ExtraParams != "" {
		dsn += "&" + d.ExtraParams
	}
	return dsn
}

type RedisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type AuthConfig struct {
	JWTSecret        string `yaml:"jwt_secret"`
	AccessTokenTTL   int    `yaml:"access_token_ttl"`
	RefreshTokenTTL  int    `yaml:"refresh_token_ttl"`
}

type ProviderConfig struct {
	ID      string   `yaml:"id"`
	Name    string   `yaml:"name"`
	APIKey  string   `yaml:"api_key"`
	BaseURL string   `yaml:"base_url"`
	Enabled bool     `yaml:"enabled"`
	Models  []string `yaml:"models"` // Supported models; empty means supports all models
}

type RateLimitConfig struct {
	Enabled    bool `yaml:"enabled"`
	DefaultRPM int  `yaml:"default_rpm"`
	DefaultTPM int  `yaml:"default_tpm"`
}

type MetricsConfig struct {
	Enabled bool   `yaml:"enabled"`
	Path    string `yaml:"path"`
}

type LogConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
}

// PaymentConfig holds payment provider configurations.
type PaymentConfig struct {
	Stripe StripeConfig `yaml:"stripe"`
	Alipay AlipayConfig `yaml:"alipay"`
	Wechat WechatConfig `yaml:"wechat"`
}

// StripeConfig holds Stripe payment configuration.
type StripeConfig struct {
	SecretKey     string `yaml:"secret_key"`
	WebhookSecret string `yaml:"webhook_secret"`
}

// AlipayConfig holds Alipay payment configuration.
type AlipayConfig struct {
	AppID      string `yaml:"app_id"`
	PrivateKey string `yaml:"private_key"`
}

// WechatConfig holds WeChat Pay configuration.
type WechatConfig struct {
	AppID  string `yaml:"app_id"`
	MchID  string `yaml:"mch_id"`
	APIKey string `yaml:"api_key"`
}

// RoutingConfig holds routing strategy configuration.
type RoutingConfig struct {
	Mode        string            `yaml:"mode"` // single, fallback, loadbalance
	HealthCheck HealthCheckConfig `yaml:"health_check"`
}

// HealthCheckConfig holds health check configuration for routing.
type HealthCheckConfig struct {
	Window         string `yaml:"window"`          // sliding window duration (e.g., "5m")
	ErrorThreshold int    `yaml:"error_threshold"` // error count threshold to mark unhealthy
}

// Load reads configuration from the given YAML file path.
// Environment variables override config values using the HI_AI_ prefix.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	// Expand environment variables in the YAML content
	expanded := os.ExpandEnv(string(data))

	cfg := &Config{}
	if err := yaml.Unmarshal([]byte(expanded), cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	applyDefaults(cfg)
	applyEnvOverrides(cfg)

	return cfg, nil
}

func applyDefaults(cfg *Config) {
	if cfg.Server.Host == "" {
		cfg.Server.Host = "0.0.0.0"
	}
	if cfg.Server.Port == 0 {
		cfg.Server.Port = 8080
	}
	if cfg.Server.ReadTimeout == 0 {
		cfg.Server.ReadTimeout = 30
	}
	if cfg.Server.WriteTimeout == 0 {
		cfg.Server.WriteTimeout = 60
	}
	if cfg.Server.IdleTimeout == 0 {
		cfg.Server.IdleTimeout = 120
	}
	if cfg.Database.Port == 0 {
		cfg.Database.Port = 5432
	}
	if cfg.Database.SSLMode == "" {
		cfg.Database.SSLMode = "disable"
	}
	if cfg.Database.MaxConns == 0 {
		cfg.Database.MaxConns = 20
	}
	if cfg.Database.MinConns == 0 {
		cfg.Database.MinConns = 5
	}
	if cfg.Redis.Addr == "" {
		cfg.Redis.Addr = "localhost:6379"
	}
	if cfg.Auth.AccessTokenTTL == 0 {
		cfg.Auth.AccessTokenTTL = 3600
	}
	if cfg.Auth.RefreshTokenTTL == 0 {
		cfg.Auth.RefreshTokenTTL = 604800
	}
	if cfg.RateLimit.DefaultRPM == 0 {
		cfg.RateLimit.DefaultRPM = 60
	}
	if cfg.RateLimit.DefaultTPM == 0 {
		cfg.RateLimit.DefaultTPM = 100000
	}
	if cfg.Metrics.Path == "" {
		cfg.Metrics.Path = "/metrics"
	}
	if cfg.Log.Level == "" {
		cfg.Log.Level = "info"
	}
	if cfg.Log.Format == "" {
		cfg.Log.Format = "json"
	}
	// Routing defaults
	if cfg.Routing.Mode == "" {
		cfg.Routing.Mode = "single" // Default for backward compatibility
	}
	if cfg.Routing.HealthCheck.Window == "" {
		cfg.Routing.HealthCheck.Window = "5m"
	}
	if cfg.Routing.HealthCheck.ErrorThreshold == 0 {
		cfg.Routing.HealthCheck.ErrorThreshold = 5
	}
}

func applyEnvOverrides(cfg *Config) {
	if v := os.Getenv("HI_AI_SERVER_PORT"); v != "" {
		fmt.Sscanf(v, "%d", &cfg.Server.Port)
	}
	if v := os.Getenv("HI_AI_DB_HOST"); v != "" {
		cfg.Database.Host = v
	}
	if v := os.Getenv("HI_AI_DB_PASSWORD"); v != "" {
		cfg.Database.Password = v
	}
	if v := os.Getenv("HI_AI_REDIS_ADDR"); v != "" {
		cfg.Redis.Addr = v
	}
	if v := os.Getenv("HI_AI_JWT_SECRET"); v != "" {
		cfg.Auth.JWTSecret = v
	}
	if v := os.Getenv("HI_AI_LOG_LEVEL"); v != "" {
		cfg.Log.Level = strings.ToLower(v)
	}
}

// Address returns the server listen address.
func (c *Config) Address() string {
	return fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
}
