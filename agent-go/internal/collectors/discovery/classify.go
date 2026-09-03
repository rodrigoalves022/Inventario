package discovery

import (
	"sort"
	"strconv"
	"strings"
)

// Catalogo FECHADO de tipos, espelhado em lib/schemas/agent-discovery.ts
// (DISCOVERED_DEVICE_TYPES). Mesma defesa em profundidade do catalogo de
// comandos remotos: a allowlist existe dos dois lados, deliberadamente
// duplicada. Se um tipo for adicionado aqui sem ser adicionado la, o servidor
// rejeita o payload com 400 — falha visivel, nao gravacao silenciosa.
const (
	TypePrinter     = "PRINTER"
	TypeSwitch      = "SWITCH"
	TypeRouter      = "ROUTER"
	TypeNAS         = "NAS"
	TypeAccessPoint = "ACCESS_POINT"
	TypeUnknown     = "UNKNOWN"
)

// Portas TCP sondadas. SNMP (161) NAO esta aqui de proposito: SNMP e' UDP, e
// um net.Dial("udp", ...) "conecta" sempre localmente, sem enviar um unico
// pacote — nunca serve como sinal de deteccao. A presenca de SNMP e' apurada
// por um GET SNMP de verdade (ver snmp.go).
//
// 9100 (RAW/JetDirect), 515 (LPD) e 631 (IPP) juntos sao o sinal FORTE de
// impressora; 445 (SMB), 22 (SSH), 80 e 443 sao sinais fracos, presentes em
// praticamente qualquer coisa.
var TCPProbePorts = []int{22, 80, 443, 445, 515, 631, 9100}

// SNMPPort so aparece em openPorts quando um GET SNMP real respondeu.
const SNMPPort = 161

var printerPorts = map[int]bool{9100: true, 515: true, 631: true}

// Signals sao as evidencias brutas coletadas para UM host. ClassifyDevice e'
// funcao pura sobre este struct — nenhuma rede, nenhum relogio.
type Signals struct {
	OpenTCPPorts  []int
	SNMPResponded bool
	SysDescr      string
	SysName       string
}

// FormatOpenPorts monta a string "80,161,9100": ordenada crescente,
// deduplicada, sem espacos. String vazia quando nao ha porta alguma (o
// servidor grava NULL, nao "").
func FormatOpenPorts(ports []int) string {
	if len(ports) == 0 {
		return ""
	}

	seen := make(map[int]bool, len(ports))
	unique := make([]int, 0, len(ports))
	for _, port := range ports {
		if port <= 0 || seen[port] {
			continue
		}
		seen[port] = true
		unique = append(unique, port)
	}
	if len(unique) == 0 {
		return ""
	}

	sort.Ints(unique)

	parts := make([]string, 0, len(unique))
	for _, port := range unique {
		parts = append(parts, strconv.Itoa(port))
	}
	return strings.Join(parts, ",")
}

// keywordRule mapeia um trecho de sysDescr/sysName para um tipo. A ORDEM
// importa: a primeira regra que casar vence, entao as mais especificas vem
// primeiro ("unifi ap" antes de "unifi", "routeros" antes de "mikrotik").
type keywordRule struct {
	keyword string
	kind    string
}

var sysDescrRules = []keywordRule{
	// Impressoras — o fabricante costuma se identificar no proprio banner.
	{"jetdirect", TypePrinter},
	{"laserjet", TypePrinter},
	{"officejet", TypePrinter},
	{"deskjet", TypePrinter},
	{"imageclass", TypePrinter},
	{"imagerunner", TypePrinter},
	{"workcentre", TypePrinter},
	{"ecosys", TypePrinter},
	{"printer", TypePrinter},
	{"impressora", TypePrinter},

	// NAS.
	{"synology", TypeNAS},
	{"diskstation", TypeNAS},
	{"rackstation", TypeNAS},
	{"qnap", TypeNAS},
	{"truenas", TypeNAS},
	{"freenas", TypeNAS},
	{"netapp", TypeNAS},

	// Access points (antes das regras genericas de fabricante de rede).
	{"access point", TypeAccessPoint},
	{"accesspoint", TypeAccessPoint},
	{"unifi ap", TypeAccessPoint},
	{"uap-", TypeAccessPoint},
	{"aironet", TypeAccessPoint},

	// Roteadores.
	{"routeros", TypeRouter},
	{"mikrotik", TypeRouter},
	{"pfsense", TypeRouter},
	{"opnsense", TypeRouter},
	{"edgerouter", TypeRouter},
	{"router", TypeRouter},
	{"gateway", TypeRouter},

	// Switches. "cisco ios" fica por ultimo entre os de rede porque IOS roda
	// tanto em switch quanto em roteador — na duvida, switch e' o caso muito
	// mais comum numa LAN de escritorio, e as regras de roteador acima ja
	// capturaram o que se identifica explicitamente como tal.
	{"switch", TypeSwitch},
	{"procurve", TypeSwitch},
	{"aruba", TypeSwitch},
	{"juniper", TypeSwitch},
	{"tp-link", TypeSwitch},
	{"ubiquiti", TypeSwitch},
	{"unifi", TypeSwitch},
	{"cisco ios", TypeSwitch},
	{"cisco", TypeSwitch},
}

// ClassifyDevice resolve o tipo a partir dos sinais coletados.
//
// PRECEDENCIA (documentada porque sinais CONFLITAM na pratica — um host com
// 9100 E 445 abertos ao mesmo tempo e' o caso classico):
//
//  1. sysDescr/sysName do SNMP. E' a AUTODESCRICAO do dispositivo, o unico
//     sinal em que ele diz o que e'; ganha de qualquer inferencia por porta.
//  2. Porta de impressao (9100/515/631). Sao portas altamente especificas —
//     praticamente nada alem de impressora e servidor de impressao escuta
//     nelas. Por isso 9100+445 => PRINTER: o 445 nao derruba o sinal forte.
//  3. Porta 445 (SMB) sozinha => NAS. E' o sinal MAIS FRACO da lista e tem
//     falso positivo conhecido e aceito: uma estacao/servidor Windows com
//     compartilhamento de arquivos tambem escuta em 445 e sera catalogada
//     como NAS. Optamos por manter (era o pedido explicito do escopo) porque
//     a maquina Windows com agente ja aparece no inventario de verdade, e a
//     linha de descoberta e' corrigivel pela leitura humana da coluna
//     Fabricante/SNMP.
//  4. Qualquer outro caso => UNKNOWN. Em especial: SNMP que responde mas cujo
//     sysDescr nao casa com nenhuma palavra-chave NAO vira SWITCH — no-break,
//     camera IP e controladora de ar-condicionado tambem falam SNMP. Preferir
//     "nao identificado" a inventar uma categoria e' o mesmo principio do
//     "nao apurado != desativado" da postura de seguranca.
func ClassifyDevice(signals Signals) string {
	if kind := classifyBySysDescr(signals.SysDescr + " " + signals.SysName); kind != "" {
		return kind
	}

	hasPrinterPort := false
	hasSMB := false
	for _, port := range signals.OpenTCPPorts {
		if printerPorts[port] {
			hasPrinterPort = true
		}
		if port == 445 {
			hasSMB = true
		}
	}

	if hasPrinterPort {
		return TypePrinter
	}
	if hasSMB {
		return TypeNAS
	}

	return TypeUnknown
}

// classifyBySysDescr devolve "" quando nenhuma palavra-chave casa — nunca um
// tipo "chutado".
func classifyBySysDescr(text string) string {
	normalized := strings.ToLower(strings.TrimSpace(text))
	if normalized == "" {
		return ""
	}

	for _, rule := range sysDescrRules {
		if strings.Contains(normalized, rule.keyword) {
			return rule.kind
		}
	}

	return ""
}
