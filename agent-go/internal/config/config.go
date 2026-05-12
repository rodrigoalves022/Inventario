package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"inventario-agent/internal/security/secretstore"
)

type Config struct {
	ServerURL   string `json:"serverUrl"`
	APIKey      string `json:"apiKey"`
	AgentName   string `json:"agentName"`
	InstalledAt string `json:"installedAt"`
}

func DefaultPath() string {
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(os.Getenv("ProgramData"), "InventarioAgent", "config.json")
	default:
		return "/opt/inventario-agent/config.json"
	}
}

func NormalizeServerURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", fmt.Errorf("serverUrl obrigatorio")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("serverUrl invalido: %w", err)
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("serverUrl deve usar http ou https")
	}

	if parsed.Host == "" {
		return "", fmt.Errorf("serverUrl deve incluir host")
	}

	return strings.TrimRight(parsed.String(), "/"), nil
}

func Load(path string) (*Config, error) {
	var cfg Config
	if err := secretstore.New().Load(path, &cfg); err != nil {
		return nil, err
	}

	serverURL, err := NormalizeServerURL(cfg.ServerURL)
	if err != nil {
		return nil, err
	}
	cfg.ServerURL = serverURL

	if cfg.APIKey == "" {
		return nil, fmt.Errorf("config incompleta: apiKey e obrigatoria")
	}

	return &cfg, nil
}

func Save(path string, cfg *Config) error {
	serverURL, err := NormalizeServerURL(cfg.ServerURL)
	if err != nil {
		return err
	}

	normalized := *cfg
	normalized.ServerURL = serverURL

	return secretstore.New().Save(path, &normalized)
}
