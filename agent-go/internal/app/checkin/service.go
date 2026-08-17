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

// SendMetricsOnce roda o ciclo curto (~10 min): coleta a amostra leve de uso
// e envia, sem passar pela coleta completa de inventario.
func SendMetricsOnce(cfg *config.Config) (*inventory.MetricsPayload, error) {
	payload, err := collectors.New().CollectMetrics()
	if err != nil {
		return nil, fmt.Errorf("coleta de metricas: %w", err)
	}

	client, err := httpapi.NewClient(cfg.ServerURL, cfg.APIKey)
	if err != nil {
		return nil, fmt.Errorf("cliente HTTP: %w", err)
	}

	if err := client.SendMetrics(payload); err != nil {
		return nil, fmt.Errorf("envio: %w", err)
	}

	return payload, nil
}
