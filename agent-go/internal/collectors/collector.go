package collectors

import "inventario-agent/internal/domain/inventory"

// Collector define o contrato de coleta por plataforma.
type Collector interface {
	Collect() (*inventory.Payload, error)
}
