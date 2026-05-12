//go:build windows

package windowscollector

import (
	"fmt"
	"math"
	"os"
	"strings"

	"inventario-agent/internal/domain/inventory"

	"github.com/yusufpapurcu/wmi"
)

type Win32_ComputerSystem struct {
	Name                string
	Manufacturer        string
	Model               string
	Domain              string
	TotalPhysicalMemory uint64
}

type Win32_BIOS struct {
	SerialNumber string
}

type Win32_Processor struct {
	Name string
}

type Win32_BaseBoard struct {
	Product string
}

type Win32_PhysicalMemory struct {
	Capacity uint64
}

type Win32_NetworkAdapterConfiguration struct {
	IPAddress            []string
	MACAddress           string
	DefaultIPGateway     []string
	DNSServerSearchOrder []string
	DHCPEnabled          bool
	IPEnabled            bool
}

type Win32_LogicalDisk struct {
	DeviceID  string
	Size      uint64
	FreeSpace uint64
	DriveType uint32
}

type Win32_DiskDrive struct {
	Model     string
	MediaType string
}

type Win32_OperatingSystem struct {
	Caption string
	Version string
}

type Collector struct{}

func New() *Collector {
	return &Collector{}
}

func (c *Collector) Collect() (*inventory.Payload, error) {
	payload := &inventory.Payload{}

	var osInfo []Win32_OperatingSystem
	if err := wmi.Query("SELECT Caption, Version FROM Win32_OperatingSystem", &osInfo); err == nil && len(osInfo) > 0 {
		payload.Sistema = osInfo[0].Caption
		payload.VersaoSO = osInfo[0].Version
	}

	var cs []Win32_ComputerSystem
	if err := wmi.Query("SELECT Name, Manufacturer, Model, Domain, TotalPhysicalMemory FROM Win32_ComputerSystem", &cs); err == nil && len(cs) > 0 {
		payload.Hostname = cs[0].Name
		payload.Fabricante = cs[0].Manufacturer
		payload.Modelo = cs[0].Model
		payload.Dominio = cs[0].Domain
		payload.RamTotalGb = int(math.Round(float64(cs[0].TotalPhysicalMemory) / (1024 * 1024 * 1024)))
	}

	if payload.Hostname == "" {
		payload.Hostname, _ = os.Hostname()
	}

	var bios []Win32_BIOS
	if err := wmi.Query("SELECT SerialNumber FROM Win32_BIOS", &bios); err == nil && len(bios) > 0 {
		payload.Serial = strings.TrimSpace(bios[0].SerialNumber)
	}

	var cpu []Win32_Processor
	if err := wmi.Query("SELECT Name FROM Win32_Processor", &cpu); err == nil && len(cpu) > 0 {
		payload.Processador = strings.TrimSpace(cpu[0].Name)
	}

	var board []Win32_BaseBoard
	if err := wmi.Query("SELECT Product FROM Win32_BaseBoard", &board); err == nil && len(board) > 0 {
		payload.PlacaMae = strings.TrimSpace(board[0].Product)
	}

	var memModules []Win32_PhysicalMemory
	if err := wmi.Query("SELECT Capacity FROM Win32_PhysicalMemory", &memModules); err == nil {
		slots := []*string{&payload.Slot1, &payload.Slot2, &payload.Slot3, &payload.Slot4}
		for i, mod := range memModules {
			if i >= len(slots) {
				break
			}
			gb := int(math.Round(float64(mod.Capacity) / (1024 * 1024 * 1024)))
			*slots[i] = fmt.Sprintf("%dGB", gb)
		}
		for _, slot := range slots {
			if *slot == "" {
				*slot = "Vazio"
			}
		}
	}

	var nics []Win32_NetworkAdapterConfiguration
	if err := wmi.Query("SELECT IPAddress, MACAddress, DefaultIPGateway, DNSServerSearchOrder, DHCPEnabled, IPEnabled FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled=True", &nics); err == nil {
		for i, nic := range nics {
			network := inventory.NetworkInfo{
				MAC:       nic.MACAddress,
				DHCP:      nic.DHCPEnabled,
				IsPrimary: i == 0,
			}
			if len(nic.IPAddress) > 0 {
				network.IP = nic.IPAddress[0]
			}
			if len(nic.DefaultIPGateway) > 0 {
				network.Gateway = nic.DefaultIPGateway[0]
			}
			if len(nic.DNSServerSearchOrder) > 0 {
				network.DNS = strings.Join(nic.DNSServerSearchOrder, ",")
			}
			payload.Redes = append(payload.Redes, network)
		}
	}

	var disks []Win32_LogicalDisk
	if err := wmi.Query("SELECT DeviceID, Size, FreeSpace, DriveType FROM Win32_LogicalDisk WHERE DriveType=3", &disks); err == nil {
		var drives []Win32_DiskDrive
		_ = wmi.Query("SELECT Model, MediaType FROM Win32_DiskDrive", &drives)

		diskType := "HDD"
		if len(drives) > 0 {
			model := strings.ToLower(drives[0].Model)
			mediaType := strings.ToLower(drives[0].MediaType)
			if strings.Contains(mediaType, "ssd") || strings.Contains(model, "ssd") || strings.Contains(model, "nvme") {
				diskType = "SSD"
			}
		}
		payload.TipoArmazenamento = diskType

		for _, disk := range disks {
			info := inventory.DiskInfo{
				Unidade:       disk.DeviceID,
				Tipo:          diskType,
				CapacidadeGb:  int(math.Round(float64(disk.Size) / (1024 * 1024 * 1024))),
				EspacoLivreGb: int(math.Round(float64(disk.FreeSpace) / (1024 * 1024 * 1024))),
			}
			if len(drives) > 0 {
				info.Modelo = strings.TrimSpace(drives[0].Model)
			}
			payload.Discos = append(payload.Discos, info)
		}
	}

	payload.Usuario = os.Getenv("USERNAME")
	payload.Software = collectSoftwareFromRegistry()

	return payload, nil
}
