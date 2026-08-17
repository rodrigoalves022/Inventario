//go:build windows

package windowscollector

import (
	"os"
	"strings"

	"inventario-agent/internal/domain/inventory"

	"github.com/yusufpapurcu/wmi"
	"golang.org/x/sys/windows"
)

type win32ProcessorLoad struct {
	LoadPercentage *uint16
}

type win32OperatingSystemMemory struct {
	FreePhysicalMemory     uint64
	TotalVisibleMemorySize uint64
}

type win32LogicalDiskUsage struct {
	DeviceID  string
	Size      uint64
	FreeSpace uint64
}

func float64Ptr(value float64) *float64 { return &value }
func int64Ptr(value int64) *int64       { return &value }

// CollectMetrics faz a amostra leve de uso, pensada para rodar a cada poucos
// minutos sem o custo da coleta completa (que varre software, seguranca,
// contas locais etc). Cada metrica fica nil quando a consulta falha, nunca 0
// — 0% de CPU pareceria maquina ociosa em vez de dado ausente.
func (c *Collector) CollectMetrics() (*inventory.MetricsPayload, error) {
	payload := &inventory.MetricsPayload{}

	hostname, _ := os.Hostname()
	payload.Hostname = hostname

	var cpus []win32ProcessorLoad
	if err := wmi.Query("SELECT LoadPercentage FROM Win32_Processor", &cpus); err == nil {
		var sum float64
		var count int
		for _, cpu := range cpus {
			if cpu.LoadPercentage != nil {
				sum += float64(*cpu.LoadPercentage)
				count++
			}
		}
		if count > 0 {
			payload.CpuPercent = float64Ptr(sum / float64(count))
		}
	}

	var osMemory []win32OperatingSystemMemory
	if err := wmi.Query("SELECT FreePhysicalMemory, TotalVisibleMemorySize FROM Win32_OperatingSystem", &osMemory); err == nil && len(osMemory) > 0 {
		totalGb := float64(osMemory[0].TotalVisibleMemorySize) / (1024 * 1024)
		freeGb := float64(osMemory[0].FreePhysicalMemory) / (1024 * 1024)
		payload.RamTotalGb = float64Ptr(totalGb)
		payload.RamUsadaGb = float64Ptr(totalGb - freeGb)
	}

	var disks []win32LogicalDiskUsage
	if err := wmi.Query("SELECT DeviceID, Size, FreeSpace FROM Win32_LogicalDisk WHERE DriveType=3", &disks); err == nil && len(disks) > 0 {
		// Preferimos a unidade do sistema; se nao for encontrada entre os
		// volumes fixos (raro), caimos no primeiro para nao deixar a amostra
		// vazia.
		systemDrive := strings.ToUpper(strings.TrimSuffix(os.Getenv("SystemDrive"), `\`))
		chosen := disks[0]
		for _, disk := range disks {
			if systemDrive != "" && strings.EqualFold(disk.DeviceID, systemDrive) {
				chosen = disk
				break
			}
		}
		totalGb := float64(chosen.Size) / (1024 * 1024 * 1024)
		freeGb := float64(chosen.FreeSpace) / (1024 * 1024 * 1024)
		payload.DiscoLivreGb = float64Ptr(freeGb)
		payload.DiscoUsadoGb = float64Ptr(totalGb - freeGb)
	}

	// GetTickCount64 via syscall direto: mais leve e confiavel do que
	// parsear Win32_OperatingSystem.LastBootUpTime (formato CIM_DATETIME).
	payload.UptimeSegundos = int64Ptr(int64(windows.DurationSinceBoot().Seconds()))

	return payload, nil
}
