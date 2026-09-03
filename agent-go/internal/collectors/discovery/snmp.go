package discovery

import (
	"strings"
	"time"

	"github.com/gosnmp/gosnmp"
)

// OIDs padrao de SNMPv2-MIB::system.
const (
	oidSysDescr = ".1.3.6.1.2.1.1.1.0"
	oidSysName  = ".1.3.6.1.2.1.1.5.0"
)

// snmpResult carrega o que o dispositivo respondeu sobre si mesmo.
type snmpResult struct {
	Responded bool
	SysDescr  string
	SysName   string
}

// querySNMP faz um GET SNMPv2c real por UDP/161 (community "public") e devolve
// sysDescr/sysName.
//
// POR QUE UM GET DE VERDADE, e nao um "probe de porta": SNMP e' UDP. Um
// net.Dial("udp", host:161) sempre "conecta" — o kernel so registra o
// endereco, nao ha handshake nem pacote na rede — entao ele NUNCA e' sinal de
// que algo esteja escutando. Sem uma resposta SNMP valida dentro do timeout,
// `Responded` fica false e a porta 161 nao entra em openPorts.
//
// A biblioteca (github.com/gosnmp/gosnmp) faz o parsing BER/ASN.1. Isso e'
// deliberado: a resposta vem de um dispositivo NAO confiavel da rede, e um
// parser ASN.1 escrito a mao sobre entrada hostil e' exatamente onde nascem
// panics e bugs de memoria. Ainda assim, todo o ciclo de varredura roda sob
// recover() (ver scan.go) — biblioteca boa nao dispensa a rede de seguranca.
//
// Community "public" fixa e SOMENTE LEITURA (Get, nunca Set): e' o default
// universal de dispositivos de rede e nao ha onde configurar outra no agente.
// Dispositivo com community trocada simplesmente nao responde — e fica
// catalogado so pelos sinais de porta, sem erro.
func querySNMP(ip string, timeout time.Duration) snmpResult {
	client := &gosnmp.GoSNMP{
		Target:    ip,
		Port:      uint16(SNMPPort),
		Community: "public",
		Version:   gosnmp.Version2c,
		Timeout:   timeout,
		Retries:   0,
		MaxOids:   gosnmp.MaxOids,
	}

	if err := client.Connect(); err != nil {
		return snmpResult{}
	}
	defer func() {
		if client.Conn != nil {
			_ = client.Conn.Close()
		}
	}()

	packet, err := client.Get([]string{oidSysDescr, oidSysName})
	if err != nil || packet == nil || len(packet.Variables) == 0 {
		return snmpResult{}
	}

	result := snmpResult{Responded: true}
	for _, variable := range packet.Variables {
		value := snmpString(variable)
		if value == "" {
			continue
		}
		switch strings.TrimPrefix(variable.Name, ".") {
		case strings.TrimPrefix(oidSysDescr, "."):
			result.SysDescr = value
		case strings.TrimPrefix(oidSysName, "."):
			result.SysName = value
		}
	}

	return result
}

// snmpString converte o valor da variavel para texto de forma DEFENSIVA: so
// aceita OctetString e String, ignora qualquer outro tipo (inclusive
// NoSuchObject/NoSuchInstance, que a lib devolve quando o OID nao existe no
// dispositivo). Trunca em 1024 para casar com o limite do schema Zod do
// servidor — um banner absurdamente longo nao deve fazer o payload inteiro ser
// rejeitado com 400.
func snmpString(variable gosnmp.SnmpPDU) string {
	var text string

	switch variable.Type {
	case gosnmp.OctetString:
		if bytes, ok := variable.Value.([]byte); ok {
			text = string(bytes)
		}
	default:
		if value, ok := variable.Value.(string); ok {
			text = value
		}
	}

	text = sanitizeSNMPText(text)
	if len(text) > 1024 {
		text = text[:1024]
	}
	return text
}

// sanitizeSNMPText remove caracteres de controle (um sysDescr real e'
// multi-linha em varios switches) e normaliza espacos — o texto vai direto
// para uma coluna exibida na UI.
func sanitizeSNMPText(text string) string {
	replaced := strings.Map(func(char rune) rune {
		if char < 32 || char == 127 {
			return ' '
		}
		return char
	}, text)

	return strings.TrimSpace(strings.Join(strings.Fields(replaced), " "))
}
