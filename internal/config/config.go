package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	Port             string `envconfig:"SCAN_PORT" default:"8080"`
	DBHost           string `envconfig:"SCAN_DB_HOST" required:"true"`
	DBPort           string `envconfig:"SCAN_DB_PORT" default:"5432"`
	DBName           string `envconfig:"SCAN_DB_NAME" default:"scan"`
	DBUser           string `envconfig:"SCAN_DB_USER" default:"scan"`
	DBPassword       string `envconfig:"SCAN_DB_PASSWORD" required:"true"`
	OIDCIssuer       string `envconfig:"SCAN_OIDC_ISSUER" required:"true"`
	OIDCClientID     string `envconfig:"SCAN_OIDC_CLIENT_ID" required:"true"`
	OIDCClientSecret string `envconfig:"SCAN_OIDC_CLIENT_SECRET" required:"true"`
	OIDCRedirectURL  string `envconfig:"SCAN_OIDC_REDIRECT_URL" required:"true"`
	SessionSecret    string `envconfig:"SCAN_SESSION_SECRET"`
	AccessPassword   string `envconfig:"SCAN_ACCESS_PASSWORD"`
	StaticDir        string `envconfig:"SCAN_STATIC_DIR" default:"./frontend/out"`
	BarcodePattern   string `envconfig:"SCAN_BARCODE_PATTERN" default:"^TL\\d{8}$"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, err
	}
	if cfg.SessionSecret == "" {
		b := make([]byte, 32)
		if _, err := rand.Read(b); err != nil {
			return nil, fmt.Errorf("generate session secret: %w", err)
		}
		cfg.SessionSecret = hex.EncodeToString(b)
	}
	return &cfg, nil
}

func (c *Config) DatabaseURL() string {
	return fmt.Sprintf("postgresql://%s:%s@%s:%s/%s", c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}
