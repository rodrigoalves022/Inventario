//go:build linux

// Package linuxcollector implementa a coleta em hosts Linux, lendo direto de
// /proc, /sys e /etc/os-release — sem dependencia de ferramentas externas
// alem de dpkg (Debian/Ubuntu) para a lista de pacotes.
//
// Escopo desta primeira versao: identificacao, hardware, rede, disco,
// software (dpkg) e contas locais. Postura de seguranca (firewall/AV) e
// perifericos (monitor/impressora/USB) ficam de fora por enquanto — cada um
// exige deteccao especifica de distro (ufw/iptables/clamav, CUPS, lsusb) que
// nao cabe no primeiro corte. Campos correspondentes ficam nil/vazios, nunca
// inventados: mesmo principio de "nao apurado" usado no coletor Windows.
package linuxcollector

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"

	"inventario-agent/internal/collectors/anydesk"
	"inventario-agent/internal/domain/inventory"
)

type Collector struct{}

func New() *Collector {
	return &Collector{}
}

func readFileTrim(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

// readOsRelease parseia /etc/os-release (formato KEY=VALUE, valores as vezes
// entre aspas). Presente em praticamente toda distro moderna.
func readOsRelease() map[string]string {
	result := make(map[string]string)
	file, err := os.Open("/etc/os-release")
	if err != nil {
		return result
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		result[key] = strings.Trim(value, `"`)
	}
	return result
}

// isRunningInWsl detecta WSL (1 ou 2) pela assinatura "microsoft" no release
// do kernel — presente tanto em "4.4.0-19041-Microsoft" (WSL1) quanto em
// "5.15.90.1-microsoft-standard-WSL2". Sem essa deteccao, o agente rodando
// dentro de um shell WSL se anuncia como se fosse um servidor Linux fisico
// independente, com o mesmo hostname da maquina Windows hospedeira —
// confundindo esse subsistema com um ativo separado no inventario.
func isRunningInWsl() bool {
	release := readFileTrim("/proc/sys/kernel/osrelease")
	return strings.Contains(strings.ToLower(release), "microsoft")
}

func readMeminfo() map[string]uint64 {
	result := make(map[string]uint64)
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return result
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		value, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			continue
		}
		result[key] = value
	}
	return result
}

func (c *Collector) Collect() (*inventory.Payload, error) {
	payload := &inventory.Payload{}

	hostname, _ := os.Hostname()
	payload.Hostname = hostname

	osRelease := readOsRelease()
	payload.Sistema = osRelease["PRETTY_NAME"]
	if isRunningInWsl() {
		payload.Sistema += " (WSL)"
	}
	payload.VersaoSO = osRelease["VERSION_ID"]

	payload.Fabricante = readFileTrim("/sys/class/dmi/id/sys_vendor")
	payload.Modelo = readFileTrim("/sys/class/dmi/id/product_name")
	payload.Serial = readFileTrim("/sys/class/dmi/id/product_serial")
	payload.PlacaMae = readFileTrim("/sys/class/dmi/id/board_name")
	payload.Processador = readCpuModelName()
	payload.Usuario = os.Getenv("USER")
	payload.AnydeskID = anydesk.CollectID()

	meminfo := readMeminfo()
	if total, ok := meminfo["MemTotal"]; ok {
		payload.RamTotalGb = int(float64(total) / (1024 * 1024))
	}

	payload.Redes = collectNetworks()
	payload.Discos = collectDisks()
	payload.Software = collectDpkgSoftware()

	accounts, accountsNote := collectLocalAccounts()
	payload.ContasLocais = accounts
	if accountsNote != "" {
		payload.Seguranca = &inventory.SecurityInfo{Observacao: accountsNote}
	}

	return payload, nil
}

func readCpuModelName() string {
	file, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		key, value, found := strings.Cut(scanner.Text(), ":")
		if !found {
			continue
		}
		if strings.TrimSpace(key) == "model name" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func float64Ptr(value float64) *float64 { return &value }
func int64Ptr(value int64) *int64       { return &value }

// CollectMetrics amostra CPU (media entre duas leituras de /proc/stat
// separadas por ~200ms, tecnica padrao — uma leitura unica de /proc/stat da
// so o acumulado desde o boot, nao uso instantaneo), RAM, disco da raiz e
// uptime.
func (c *Collector) CollectMetrics() (*inventory.MetricsPayload, error) {
	payload := &inventory.MetricsPayload{}

	hostname, _ := os.Hostname()
	payload.Hostname = hostname

	if cpuPercent, ok := sampleCpuPercent(); ok {
		payload.CpuPercent = float64Ptr(cpuPercent)
	}

	meminfo := readMeminfo()
	if total, ok := meminfo["MemTotal"]; ok {
		totalGb := float64(total) / (1024 * 1024)
		payload.RamTotalGb = float64Ptr(totalGb)
		if available, ok := meminfo["MemAvailable"]; ok {
			payload.RamUsadaGb = float64Ptr(totalGb - float64(available)/(1024*1024))
		}
	}

	if usedGb, freeGb, ok := statfsGb("/"); ok {
		payload.DiscoUsadoGb = float64Ptr(usedGb)
		payload.DiscoLivreGb = float64Ptr(freeGb)
	}

	if uptime, ok := readUptimeSeconds(); ok {
		payload.UptimeSegundos = int64Ptr(uptime)
	}

	return payload, nil
}

type cpuTimes struct {
	idle  uint64
	total uint64
}

func readCpuTimes() (cpuTimes, bool) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return cpuTimes{}, false
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return cpuTimes{}, false
	}
	fields := strings.Fields(scanner.Text())
	// "cpu  user nice system idle iowait irq softirq steal guest guest_nice"
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuTimes{}, false
	}

	var total uint64
	var idle uint64
	for i, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			continue
		}
		total += value
		if i == 3 { // idle e' a 4a coluna (indice 3 apos remover "cpu")
			idle = value
		}
	}
	return cpuTimes{idle: idle, total: total}, true
}

func sampleCpuPercent() (float64, bool) {
	first, ok := readCpuTimes()
	if !ok {
		return 0, false
	}
	time.Sleep(200 * time.Millisecond)
	second, ok := readCpuTimes()
	if !ok {
		return 0, false
	}

	totalDelta := second.total - first.total
	idleDelta := second.idle - first.idle
	if totalDelta == 0 {
		return 0, false
	}

	usedPercent := (1 - float64(idleDelta)/float64(totalDelta)) * 100
	if usedPercent < 0 {
		usedPercent = 0
	}
	if usedPercent > 100 {
		usedPercent = 100
	}
	return usedPercent, true
}

func statfsGb(path string) (usedGb float64, freeGb float64, ok bool) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0, false
	}
	blockSize := float64(stat.Bsize)
	totalGb := float64(stat.Blocks) * blockSize / (1024 * 1024 * 1024)
	freeGb = float64(stat.Bavail) * blockSize / (1024 * 1024 * 1024)
	usedGb = totalGb - freeGb
	return usedGb, freeGb, true
}

func readUptimeSeconds() (int64, bool) {
	data := readFileTrim("/proc/uptime")
	if data == "" {
		return 0, false
	}
	fields := strings.Fields(data)
	if len(fields) == 0 {
		return 0, false
	}
	seconds, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, false
	}
	return int64(seconds), true
}
