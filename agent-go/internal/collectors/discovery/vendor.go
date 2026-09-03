package discovery

import "strings"

// vendorKeywords resolve o fabricante a partir do sysDescr/sysName do SNMP —
// esta e' a fonte PREFERENCIAL: e' o proprio dispositivo se identificando.
var vendorKeywords = []keywordRule{
	{"hewlett", "HP"},
	{"hp ", "HP"},
	{"jetdirect", "HP"},
	{"laserjet", "HP"},
	{"procurve", "HP"},
	{"aruba", "Aruba Networks"},
	{"cisco", "Cisco"},
	{"mikrotik", "MikroTik"},
	{"routeros", "MikroTik"},
	{"ubiquiti", "Ubiquiti"},
	{"unifi", "Ubiquiti"},
	{"edgerouter", "Ubiquiti"},
	{"juniper", "Juniper"},
	{"tp-link", "TP-Link"},
	{"d-link", "D-Link"},
	{"synology", "Synology"},
	{"diskstation", "Synology"},
	{"qnap", "QNAP"},
	{"epson", "Epson"},
	{"brother", "Brother"},
	{"canon", "Canon"},
	{"lexmark", "Lexmark"},
	{"kyocera", "Kyocera"},
	{"xerox", "Xerox"},
	{"zebra", "Zebra"},
	{"dell", "Dell"},
	{"netgear", "Netgear"},
	{"intelbras", "Intelbras"},
}

// ouiPrefixes e' uma tabela MINUSCULA de prefixos OUI, usada apenas como
// fallback quando o SNMP nao respondeu ou nao identificou nada.
//
// Decisao explicita: NAO embutir a base OUI completa da IEEE. Sao ~35 mil
// prefixos, varios MB — peso que nao se justifica no binario de um agente que
// e' distribuido por auto-update para toda a frota, para um campo meramente
// informativo. Sem SNMP e sem match aqui, `vendor` fica NULO; jamais
// inventado.
var ouiPrefixes = map[string]string{
	"00:1B:78": "HP",
	"00:17:A4": "HP",
	"3C:D9:2B": "HP",
	"00:1E:C2": "Apple",
	"00:0C:29": "VMware",
	"00:50:56": "VMware",
	"00:1A:A0": "Dell",
	"B8:2A:72": "Dell",
	"00:0A:F7": "Cisco",
	"00:1B:D7": "Cisco",
	"00:23:04": "Cisco",
	"DC:9F:DB": "Ubiquiti",
	"24:A4:3C": "Ubiquiti",
	"78:8A:20": "Ubiquiti",
	"4C:5E:0C": "MikroTik",
	"64:D1:54": "MikroTik",
	"00:11:32": "Synology",
	"00:08:9B": "Epson",
	"00:80:77": "Brother",
	"00:1E:8F": "Canon",
	"50:C7:BF": "TP-Link",
}

// VendorFromSysDescr extrai o fabricante do banner SNMP. Devolve "" quando
// nada casa — o chamador trata "" como "nao apurado" e envia null.
func VendorFromSysDescr(text string) string {
	normalized := strings.ToLower(strings.TrimSpace(text))
	if normalized == "" {
		return ""
	}

	for _, rule := range vendorKeywords {
		if strings.Contains(normalized, rule.keyword) {
			return rule.kind
		}
	}

	return ""
}

// VendorFromMAC resolve o fabricante pelos 3 primeiros octetos do MAC contra a
// tabela pequena acima. Aceita as duas grafias comuns ("00-1b-78-..." do
// Windows e "00:1b:78:..." do padrao IEEE). Devolve "" se o MAC for invalido
// ou o prefixo nao estiver na tabela.
func VendorFromMAC(mac string) string {
	normalized := strings.ToUpper(strings.TrimSpace(mac))
	normalized = strings.ReplaceAll(normalized, "-", ":")

	parts := strings.Split(normalized, ":")
	if len(parts) < 3 {
		return ""
	}
	for _, part := range parts[:3] {
		if len(part) != 2 {
			return ""
		}
	}

	return ouiPrefixes[strings.Join(parts[:3], ":")]
}

// ResolveVendor aplica a precedencia: SNMP primeiro, tabela OUI como fallback,
// "" (=> null no servidor) quando nenhum dos dois resolve.
func ResolveVendor(sysDescr, sysName, mac string) string {
	if vendor := VendorFromSysDescr(sysDescr + " " + sysName); vendor != "" {
		return vendor
	}
	return VendorFromMAC(mac)
}
