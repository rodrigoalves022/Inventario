package checkin

import (
	"fmt"

	"inventario-agent/internal/collectors"
	"inventario-agent/internal/config"
	"inventario-agent/internal/domain/inventory"
	"inventario-agent/internal/transport/httpapi"
)

func CollectOnce() (*inventory.Payload, error) {
	return collectors.New().Collect()
}

func SendOnce(cfg *config.Config) (*inventory.Payload, error) {
	payload, err := CollectOnce()
	if err != nil {
		return nil, fmt.Errorf("coleta: %w", err)
	}

	client, err := httpapi.NewClient(cfg.ServerURL, cfg.APIKey)
	if err != nil {
		return nil, fmt.Errorf("cliente HTTP: %w", err)
	}

	if err := client.Send(payload); err != nil {
		return nil, fmt.Errorf("envio: %w", err)
	}

	return payload, nil
}
