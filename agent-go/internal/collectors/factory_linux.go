//go:build linux

package collectors

import linuxcollector "inventario-agent/internal/collectors/linux"

func New() Collector {
	return linuxcollector.New()
}
