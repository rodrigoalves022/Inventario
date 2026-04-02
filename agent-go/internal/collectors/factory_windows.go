//go:build windows

package collectors

import windowscollector "inventario-agent/internal/collectors/windows"

func New() Collector {
	return windowscollector.New()
}
