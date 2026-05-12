//go:build !windows

package collectors

import (
	"errors"

	"inventario-agent/internal/domain/inventory"
)

type unsupportedCollector struct{}

func New() Collector {
	return unsupportedCollector{}
}

func (unsupportedCollector) Collect() (*inventory.Payload, error) {
	return nil, errors.New("coletor nativo ainda nao implementado para esta plataforma")
}
