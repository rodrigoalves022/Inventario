package checkin

import (
	"fmt"

	"inventario-agent/internal/collectors"
	"inventario-agent/internal/collectors/discovery"
	"inventario-agent/internal/config"
	"inventario-agent/internal/domain/inventory"
	"inventario-agent/internal/transport/httpapi"
	"inventario-agent/internal/version"
)

func CollectOnce() (*inventory.Payload, error) {
	payload, err := collectors.New().Collect()
	if err != nil {
		return nil, err
	}
	if payload.AgentVersion == "" {
		payload.AgentVersion = version.Version
	}
	return payload, nil
}

// ForceUpdateOnce envia um check-in sinalizando AgentVersion="0.0.0" para que
// o servidor devolva updateAvailable=true + updateMetadata (URL e SHA-256 do
// binario publicado) e o cliente HTTP dispare updater.RunAsync imediatamente.
func ForceUpdateOnce(cfg *config.Config) error {
	payload, err := CollectOnce()
	if err != nil {
		return fmt.Errorf("coleta: %w", err)
	}
	payload.AgentVersion = "0.0.0"

	client, err := httpapi.NewClient(cfg.ServerURL, cfg.APIKey)
	if err != nil {
		return fmt.Errorf("cliente HTTP: %w", err)
	}

	if err := client.Send(payload); err != nil {
		return fmt.Errorf("envio: %w", err)
	}
	return nil
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
	if payload.AgentVersion == "" {
		payload.AgentVersion = version.Version
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

// SendDiscoveryOnce roda o ciclo de descoberta de rede (~6h): varre a /24 da
// interface primaria e envia os dispositivos encontrados. Espelha
// SendMetricsOnce.
//
// NAO checa httpapi.DiscoveryEnabled() aqui de proposito: quem decide se o
// ciclo AUTOMATICO deve rodar e' o agendador (service_windows.go). Esta funcao
// tambem atende o subcomando manual `discovery`, que e' uma acao explicita de
// um operador na maquina — e mesmo nesse caso o gate real continua sendo o do
// servidor, que descarta o payload com 202 se o tenant nao autorizou.
func SendDiscoveryOnce(cfg *config.Config) (*inventory.DiscoveryPayload, error) {
	payload, err := discovery.Scan(discovery.Options{})
	if err != nil {
		return nil, fmt.Errorf("varredura de descoberta: %w", err)
	}

	client, err := httpapi.NewClient(cfg.ServerURL, cfg.APIKey)
	if err != nil {
		return nil, fmt.Errorf("cliente HTTP: %w", err)
	}

	if err := client.SendDiscovery(payload); err != nil {
		return nil, fmt.Errorf("envio: %w", err)
	}

	return payload, nil
}
