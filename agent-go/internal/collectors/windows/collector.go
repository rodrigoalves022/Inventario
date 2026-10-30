//go:build windows

package windowscollector

import (
	"fmt"
	"math"
	"os"
	"strings"

	"inventario-agent/internal/collectors/anydesk"
	"inventario-agent/internal/domain/inventory"

	"github.com/yusufpapurcu/wmi"
)

type Win32_ComputerSystem struct {
	Name                string
	Manufacturer        string
	Model               string
	Domain              string
	TotalPhysicalMemory uint64
	UserName            string
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
	// DriveType e' documentado como uint32, mas alguns providers WMI devolvem
	// int32 — mesmo caso de ProductState em security.go. int32 funciona igual
	// pois o valor e' um enum pequeno (0-6).
	DriveType int32
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
	csUserName := ""
	if err := wmi.Query("SELECT Name, Manufacturer, Model, Domain, TotalPhysicalMemory, UserName FROM Win32_ComputerSystem", &cs); err == nil && len(cs) > 0 {
		payload.Hostname = cs[0].Name
		payload.Fabricante = cs[0].Manufacturer
		payload.Modelo = cs[0].Model
		payload.Dominio = cs[0].Domain
		csUserName = cs[0].UserName
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

	encryptionByDrive := collectDiskEncryption()

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
			// Mapa vazio (consulta falhou) deixa o campo em branco de proposito:
			// nao ha como afirmar que o volume esta desprotegido.
			info.Criptografia = encryptionByDrive[strings.ToUpper(disk.DeviceID)]
			payload.Discos = append(payload.Discos, info)
		}
	}

	payload.Usuario = resolveInteractiveUser(csUserName)
	payload.AnydeskID = anydesk.CollectID()
	payload.Software = collectSoftwareFromRegistry()
	payload.Seguranca = collectSecurity()
	payload.Monitores = collectMonitors()
	payload.Impressoras = collectPrinters()
	payload.DispositivosUsb = collectUsbDevices()

	accounts, accountsNote := collectLocalAccounts()
	payload.ContasLocais = accounts
	if accountsNote != "" && payload.Seguranca != nil {
		if payload.Seguranca.Observacao == "" {
			payload.Seguranca.Observacao = accountsNote
		} else {
			payload.Seguranca.Observacao += "; " + accountsNote
		}
		if len(payload.Seguranca.Observacao) > 500 {
			payload.Seguranca.Observacao = payload.Seguranca.Observacao[:500]
		}
	}

	return payload, nil
}

func isSystemAccount(name string) bool {
	upper := strings.ToUpper(strings.TrimSpace(name))
	return upper == "SYSTEM" || upper == "LOCAL SERVICE" || upper == "NETWORK SERVICE" || strings.HasSuffix(upper, "$")
}

// resolveInteractiveUser devolve o usuario humano logado no console. Como
// servico (Session 0) USERNAME e' SYSTEM/HOST$, entao so o WMI (UserName de
// Win32_ComputerSystem) enxerga a sessao interativa; sem ninguem logado,
// devolve vazio para o servidor preservar o ultimo usuario conhecido.
func resolveInteractiveUser(wmiUser string) string {
	wmiUser = strings.TrimSpace(wmiUser)
	if wmiUser != "" {
		if isSystemAccount(wmiUser) {
			return ""
		}
		if idx := strings.LastIndex(wmiUser, `\`); idx >= 0 {
			return strings.TrimSpace(wmiUser[idx+1:])
		}
		return wmiUser
	}

	envUser := strings.TrimSpace(os.Getenv("USERNAME"))
	if isSystemAccount(envUser) {
		return ""
	}
	return envUser
}
