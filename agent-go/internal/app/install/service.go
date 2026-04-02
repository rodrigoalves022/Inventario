package install

import (
	"time"

	"inventario-agent/internal/config"
	"inventario-agent/internal/transport/httpapi"
)

type Options struct {
	ServerURL     string
	AdminSecret   string
	Client        string
	EnrollmentKey string
	AgentName     string
}

func Run(options Options, now time.Time) (*config.Config, error) {
	result, err := httpapi.Register(httpapi.RegisterOptions{
		ServerURL:     options.ServerURL,
		AdminSecret:   options.AdminSecret,
		Client:        options.Client,
		EnrollmentKey: options.EnrollmentKey,
		AgentName:     options.AgentName,
	})
	if err != nil {
		return nil, err
	}

	cfg := &config.Config{
		ServerURL:   options.ServerURL,
		APIKey:      result.APIKey,
		AgentName:   options.AgentName,
		InstalledAt: now.Format(time.RFC3339),
	}

	if err := config.Save(config.DefaultPath(), cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}
