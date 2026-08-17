package collectors

import "inventario-agent/internal/domain/inventory"

// Collector define o contrato de coleta por plataforma.
type Collector interface {
	Collect() (*inventory.Payload, error)
	// CollectMetrics faz a amostra leve de uso (CPU/RAM/disco/uptime), pensada
	// para rodar a cada poucos minutos sem o custo da coleta completa.
	CollectMetrics() (*inventory.MetricsPayload, error)
}
