package discovery

import (
	"strings"
)

// ParseARPOutput extrai o mapa IP -> MAC da saida de `arp -a`.
//
// Fica num arquivo NEUTRO de plataforma (nao em arp_windows.go) de proposito:
// e' a parte pura e testavel do modulo, e o teste precisa rodar em qualquer
// plataforma de CI, nao so em Windows. A execucao do comando em si, essa sim,
// e' especifica (arp_windows.go / arp_stub.go).
//
// Formato tratado (saida do Windows, pt-BR e en-US — o cabecalho muda de
// idioma, as LINHAS DE DADOS nao):
//
//	Interface: 192.168.1.37 --- 0xb
//	  Endereço IP           Endereço físico       Tipo
//	  192.168.1.1           d4-6e-0e-11-22-33     dinâmico
//	  192.168.1.255         ff-ff-ff-ff-ff-ff     estático
//
// A analise e' posicional-agnostica: qualquer linha cujo primeiro campo pareca
// um IPv4 e cujo segundo campo pareca um MAC vira uma entrada. Linhas de
// cabecalho, de interface e em branco simplesmente nao casam esse formato e
// sao ignoradas, sem depender do idioma do SO.
//
// Enderecos de broadcast/multicast (ff-ff-... e 01-00-5e-...) sao descartados:
// nao pertencem a nenhum dispositivo real.
func ParseARPOutput(output string) map[string]string {
	result := make(map[string]string)

	for _, line := range strings.Split(output, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 2 {
			continue
		}

		ip := fields[0]
		if _, err := ParseIPv4(ip); err != nil {
			continue
		}

		mac := NormalizeMAC(fields[1])
		if mac == "" || isNonPhysicalMAC(mac) {
			continue
		}

		result[ip] = mac
	}

	return result
}

// NormalizeMAC valida e normaliza um MAC para "AA:BB:CC:DD:EE:FF" (maiusculas,
// separado por ':'). Devolve "" para qualquer coisa que nao seja um MAC de 6
// octetos hexadecimais — a saida de `arp -a` e' texto do SO, tratado aqui como
// entrada a validar, nao como dado confiavel.
func NormalizeMAC(value string) string {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "-", ":")

	parts := strings.Split(normalized, ":")
	if len(parts) != 6 {
		return ""
	}

	for _, part := range parts {
		if len(part) != 2 {
			return ""
		}
		for _, char := range part {
			isDigit := char >= '0' && char <= '9'
			isHex := char >= 'A' && char <= 'F'
			if !isDigit && !isHex {
				return ""
			}
		}
	}

	return strings.Join(parts, ":")
}

func isNonPhysicalMAC(mac string) bool {
	if mac == "FF:FF:FF:FF:FF:FF" || mac == "00:00:00:00:00:00" {
		return true
	}
	// IPv4 multicast mapeia para 01:00:5E:xx:xx:xx.
	return strings.HasPrefix(mac, "01:00:5E")
}
