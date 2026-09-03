package discovery

import (
	"fmt"
	"log"
	"net"
	"os"
	"sync"
	"time"

	"inventario-agent/internal/domain/inventory"
)

const (
	// Timeout por porta TCP. 500ms e' generoso para uma LAN e curto o bastante
	// para nao empilhar: 253 hosts x 7 portas, com 20 workers, fica na casa dos
	// segundos para hosts vivos (que respondem imediato) e no pior caso alguns
	// minutos numa /24 inteiramente vazia — ciclo de 6h, fora do caminho
	// critico de qualquer coisa.
	defaultPortTimeout = 500 * time.Millisecond

	// Timeout do GET SNMP. Maior que o de TCP: dispositivo embarcado (switch,
	// impressora) costuma ser lento para montar a resposta.
	defaultSNMPTimeout = 1500 * time.Millisecond

	// Worker pool. 20 goroutines varrem a /24 sem saturar a tabela de conexoes
	// do SO nem parecer um flood para um IDS.
	defaultWorkers = 20
)

// Options permite sobrescrever os padroes (usado em teste e no subcomando
// manual). Campos zerados caem no default.
type Options struct {
	// LocalIP da interface primaria. Vazio => descoberto por PrimaryIPv4().
	LocalIP     string
	Workers     int
	PortTimeout time.Duration
	SNMPTimeout time.Duration
}

// Scan varre a /24 da interface primaria e devolve o payload pronto para envio.
//
// SEM PING. Go stdlib nao tem ICMP; golang.org/x/net/icmp exige raw socket
// (privilegio elevado) e e' bloqueado/instavel no Windows. O sinal de "host
// vivo" e' a PROPRIA resposta de qualquer probe TCP ou do GET SNMP.
//
// LIMITACAO ACEITA E DOCUMENTADA: um dispositivo com TODAS as portas sondadas
// fechadas e sem SNMP fica invisivel para a descoberta. E' o trade-off por nao
// exigir privilegio de raw socket no agente.
func Scan(options Options) (payload *inventory.DiscoveryPayload, err error) {
	// A varredura NUNCA pode derrubar o servico do agente: ela toca rede
	// hostil e faz parsing de resposta de dispositivo de terceiros. Qualquer
	// panico vira erro comum aqui dentro.
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Printf("[ERROR] Panico recuperado na varredura de descoberta: %v", recovered)
			payload = nil
			err = fmt.Errorf("panico na varredura: %v", recovered)
		}
	}()

	workers := options.Workers
	if workers <= 0 {
		workers = defaultWorkers
	}
	portTimeout := options.PortTimeout
	if portTimeout <= 0 {
		portTimeout = defaultPortTimeout
	}
	snmpTimeout := options.SNMPTimeout
	if snmpTimeout <= 0 {
		snmpTimeout = defaultSNMPTimeout
	}

	localIP := options.LocalIP
	if localIP == "" {
		localIP, err = PrimaryIPv4()
		if err != nil {
			return nil, err
		}
	}

	subnet, err := Slash24(localIP)
	if err != nil {
		return nil, err
	}

	hosts, err := HostsInSlash24(localIP)
	if err != nil {
		return nil, err
	}

	found := probeHosts(hosts, workers, portTimeout, snmpTimeout)

	// ARP DEPOIS dos probes: as proprias conexoes TCP acima ja populam o cache
	// ARP do SO, entao a leitura aqui aproveita esse efeito colateral em vez de
	// emitir trafego proprio. Falha de leitura nao aborta nada — os MACs
	// simplesmente ficam nulos.
	arpTable, arpErr := readARPTable()
	if arpErr != nil {
		log.Printf("[WARN] Leitura da tabela ARP falhou (MAC ficara nulo): %v", arpErr)
		arpTable = map[string]string{}
	}

	hostname, _ := os.Hostname()

	devices := make([]inventory.DiscoveredDevice, 0, len(found))
	for _, host := range found {
		mac := arpTable[host.IP]

		devices = append(devices, inventory.DiscoveredDevice{
			IP:           host.IP,
			Mac:          mac,
			Hostname:     resolveHostname(host.IP),
			Vendor:       ResolveVendor(host.SNMP.SysDescr, host.SNMP.SysName, mac),
			DeviceType:   ClassifyDevice(Signals{OpenTCPPorts: host.OpenPorts, SNMPResponded: host.SNMP.Responded, SysDescr: host.SNMP.SysDescr, SysName: host.SNMP.SysName}),
			SnmpSysDescr: host.SNMP.SysDescr,
			OpenPorts:    FormatOpenPorts(allPorts(host)),
		})
	}

	return &inventory.DiscoveryPayload{
		Hostname: hostname,
		Subnet:   subnet,
		Devices:  devices,
	}, nil
}

type hostResult struct {
	IP        string
	OpenPorts []int
	SNMP      snmpResult
}

// allPorts junta as portas TCP com 161 — e' o unico lugar onde 161 entra, e so
// quando um GET SNMP REAL respondeu (nunca por "probe de porta UDP", que nao
// existe).
func allPorts(host hostResult) []int {
	if !host.SNMP.Responded {
		return host.OpenPorts
	}
	return append(append([]int{}, host.OpenPorts...), SNMPPort)
}

// probeHosts distribui os IPs entre `workers` goroutines. So entram no
// resultado os hosts que deram ALGUM sinal (porta TCP ou SNMP) — o resto da
// /24 nao existe para o inventario de descoberta.
func probeHosts(hosts []string, workers int, portTimeout, snmpTimeout time.Duration) []hostResult {
	jobs := make(chan string)
	results := make(chan hostResult)

	var waitGroup sync.WaitGroup
	for i := 0; i < workers; i++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			// Recover POR WORKER, alem do recover geral de Scan: um panico numa
			// goroutine NAO e' capturado pelo defer de quem a lancou — sem isto,
			// derrubaria o processo inteiro do servico.
			defer func() {
				if recovered := recover(); recovered != nil {
					log.Printf("[ERROR] Panico recuperado em worker de varredura: %v", recovered)
				}
			}()

			for ip := range jobs {
				if result, ok := probeHost(ip, portTimeout, snmpTimeout); ok {
					results <- result
				}
			}
		}()
	}

	go func() {
		for _, host := range hosts {
			jobs <- host
		}
		close(jobs)
	}()

	go func() {
		waitGroup.Wait()
		close(results)
	}()

	found := make([]hostResult, 0, 32)
	for result := range results {
		found = append(found, result)
	}
	return found
}

func probeHost(ip string, portTimeout, snmpTimeout time.Duration) (hostResult, bool) {
	result := hostResult{IP: ip}

	for _, port := range TCPProbePorts {
		if dialTCP(ip, port, portTimeout) {
			result.OpenPorts = append(result.OpenPorts, port)
		}
	}

	result.SNMP = querySNMP(ip, snmpTimeout)

	if len(result.OpenPorts) == 0 && !result.SNMP.Responded {
		return hostResult{}, false
	}

	return result, true
}

func dialTCP(ip string, port int, timeout time.Duration) bool {
	address := net.JoinHostPort(ip, fmt.Sprintf("%d", port))
	conn, err := net.DialTimeout("tcp", address, timeout)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

// resolveHostname faz um PTR reverso, best-effort. DNS interno costuma ter o
// nome de impressora/NAS; quando nao tem, devolve "" (o servidor grava NULL) —
// nunca o proprio IP como se fosse nome.
func resolveHostname(ip string) string {
	names, err := net.LookupAddr(ip)
	if err != nil || len(names) == 0 {
		return ""
	}
	name := names[0]
	if len(name) > 0 && name[len(name)-1] == '.' {
		name = name[:len(name)-1]
	}
	if len(name) > 255 {
		name = name[:255]
	}
	return name
}
