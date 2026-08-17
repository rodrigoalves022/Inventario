//go:build windows

package windowscollector

import (
	"math"
	"regexp"
	"strings"

	"inventario-agent/internal/domain/inventory"

	"github.com/yusufpapurcu/wmi"
)

// WmiMonitorID vive em root\wmi, nao root\cimv2 — Win32_DesktopMonitor nao
// expoe fabricante/serie reais (normalmente devolve "Generic PnP Monitor").
// Strings vem como arrays de uint16 do EDID, padded com zeros.
type wmiMonitorID struct {
	InstanceName      string
	Active            bool
	ManufacturerName  []uint16
	SerialNumberID    []uint16
	UserFriendlyName  []uint16
	YearOfManufacture uint16
}

// MaxHorizontalImageSize/MaxVerticalImageSize vem do EDID em CENTIMETROS
// inteiros — a conversao pra polegadas e' sempre aproximada.
type wmiMonitorBasicDisplayParams struct {
	InstanceName           string
	MaxHorizontalImageSize uint8
	MaxVerticalImageSize   uint8
}

// VideoOutputTechnology segue o enum D3DKMDT_VIDEO_OUTPUT_TECHNOLOGY.
type wmiMonitorConnectionParams struct {
	InstanceName          string
	VideoOutputTechnology uint32
}

type win32Printer struct {
	Name       string
	PortName   string
	DriverName string
	Default    bool
	Network    bool
}

type win32PnpUsbEntity struct {
	Name     string
	DeviceID string
	Service  string
}

func decodeEdidString(values []uint16) string {
	var b strings.Builder
	for _, v := range values {
		if v == 0 {
			break
		}
		b.WriteByte(byte(v))
	}
	return strings.TrimSpace(b.String())
}

func videoOutputTechnologyLabel(value uint32) string {
	switch value {
	case 0:
		return "VGA"
	case 4:
		return "DVI"
	case 5:
		return "HDMI"
	case 10, 11:
		return "DisplayPort"
	case 6:
		return "LVDS (interno)"
	case 0x80000000:
		return "Interno"
	default:
		// Tecnologias raras (S-Video, componente, UDI, Miracast...) ou valor
		// nao inicializado (0xFFFFFFFF) — deixamos em branco em vez de
		// adivinhar um rotulo.
		return ""
	}
}

// collectMonitors correlaciona tres classes de root\wmi pelo InstanceName.
// Devolve lista vazia (nao erro) quando a maquina nao tem monitor com EDID
// legivel — comum em servidores headless, VMs e sessoes RDP.
func collectMonitors() []inventory.MonitorInfo {
	var ids []wmiMonitorID
	if err := wmi.QueryNamespace(
		"SELECT InstanceName, Active, ManufacturerName, SerialNumberID, UserFriendlyName, YearOfManufacture FROM WmiMonitorID",
		&ids,
		`root\wmi`,
	); err != nil || len(ids) == 0 {
		return nil
	}

	var displayParams []wmiMonitorBasicDisplayParams
	_ = wmi.QueryNamespace(
		"SELECT InstanceName, MaxHorizontalImageSize, MaxVerticalImageSize FROM WmiMonitorBasicDisplayParams",
		&displayParams,
		`root\wmi`,
	)
	sizeByInstance := make(map[string][2]uint8, len(displayParams))
	for _, p := range displayParams {
		sizeByInstance[p.InstanceName] = [2]uint8{p.MaxHorizontalImageSize, p.MaxVerticalImageSize}
	}

	var connParams []wmiMonitorConnectionParams
	_ = wmi.QueryNamespace(
		"SELECT InstanceName, VideoOutputTechnology FROM WmiMonitorConnectionParams",
		&connParams,
		`root\wmi`,
	)
	connByInstance := make(map[string]uint32, len(connParams))
	for _, c := range connParams {
		connByInstance[c.InstanceName] = c.VideoOutputTechnology
	}

	var monitors []inventory.MonitorInfo
	for _, id := range ids {
		if !id.Active {
			continue
		}
		info := inventory.MonitorInfo{
			Fabricante: decodeEdidString(id.ManufacturerName),
			Modelo:     decodeEdidString(id.UserFriendlyName),
			Serial:     decodeEdidString(id.SerialNumberID),
		}
		if id.YearOfManufacture > 0 {
			info.Ano = int(id.YearOfManufacture)
		}
		if size, ok := sizeByInstance[id.InstanceName]; ok && size[0] > 0 && size[1] > 0 {
			diagonalCm := math.Sqrt(float64(size[0])*float64(size[0]) + float64(size[1])*float64(size[1]))
			info.Polegadas = math.Round((diagonalCm/2.54)*10) / 10
		}
		if tech, ok := connByInstance[id.InstanceName]; ok {
			info.Conexao = videoOutputTechnologyLabel(tech)
		}
		monitors = append(monitors, info)
	}
	return monitors
}

func collectPrinters() []inventory.PrinterInfo {
	var printers []win32Printer
	if err := wmi.Query("SELECT Name, PortName, DriverName, Default, Network FROM Win32_Printer", &printers); err != nil {
		return nil
	}

	result := make([]inventory.PrinterInfo, 0, len(printers))
	for _, p := range printers {
		name := strings.TrimSpace(p.Name)
		if name == "" {
			continue
		}
		result = append(result, inventory.PrinterInfo{
			Nome:   name,
			Porta:  strings.TrimSpace(p.PortName),
			Driver: strings.TrimSpace(p.DriverName),
			Padrao: p.Default,
			DeRede: p.Network,
		})
	}
	return result
}

var (
	usbVidPattern = regexp.MustCompile(`(?i)VID_([0-9A-F]{4})`)
	usbPidPattern = regexp.MustCompile(`(?i)PID_([0-9A-F]{4})`)
)

// usbHubServices filtra os drivers de hub/controlador, que aparecem na mesma
// classe WMI que os dispositivos reais e nao interessam ao inventario.
var usbHubServices = map[string]bool{
	"usbhub":  true,
	"usbhub3": true,
	"usbxhci": true,
}

// parseUsbDeviceID extrai VID/PID de qualquer posicao do DeviceID (o formato
// varia: as vezes tem um segmento &REV_ entre eles) e usa o ultimo trecho
// apos a barra como identificador. Em dispositivos sem serial persistente,
// esse trecho e' um InstanceID gerado pelo Windows, nao um serial de
// fabrica — nao ha como distinguir os dois casos so pelo formato.
func parseUsbDeviceID(deviceID string) (vendorId, productId, serial string, ok bool) {
	vidMatch := usbVidPattern.FindStringSubmatch(deviceID)
	pidMatch := usbPidPattern.FindStringSubmatch(deviceID)
	if vidMatch == nil || pidMatch == nil {
		return "", "", "", false
	}

	parts := strings.Split(deviceID, `\`)
	if len(parts) >= 3 {
		serial = parts[len(parts)-1]
	}
	return strings.ToUpper(vidMatch[1]), strings.ToUpper(pidMatch[1]), serial, true
}

const maxUsbDevices = 200

// collectUsbDevices filtra hubs/controladores e deduplica por VID+PID+serial:
// dispositivos compostos (headset, leitor biometrico) geram uma entrada
// Win32_PnPEntity por interface (audio, HID...), todas com o mesmo VID/PID.
func collectUsbDevices() []inventory.UsbDeviceInfo {
	var entities []win32PnpUsbEntity
	if err := wmi.Query("SELECT Name, DeviceID, Service FROM Win32_PnPEntity WHERE DeviceID LIKE 'USB%'", &entities); err != nil {
		return nil
	}

	seen := make(map[string]bool, len(entities))
	result := make([]inventory.UsbDeviceInfo, 0, len(entities))
	for _, entity := range entities {
		if usbHubServices[strings.ToLower(strings.TrimSpace(entity.Service))] {
			continue
		}

		vendorId, productId, serial, ok := parseUsbDeviceID(entity.DeviceID)
		if !ok {
			continue
		}

		key := vendorId + productId + serial
		if seen[key] {
			continue
		}
		seen[key] = true

		if len(result) >= maxUsbDevices {
			break
		}
		result = append(result, inventory.UsbDeviceInfo{
			Nome:      strings.TrimSpace(entity.Name),
			VendorId:  vendorId,
			ProductId: productId,
			Serial:    serial,
		})
	}
	return result
}
