package discovery

import (
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
)

// ErrNoPrimaryIPv4 e' devolvido quando nenhuma interface util foi encontrada
// (maquina sem rede, so loopback, ou so IPv6). Nao e' condicao de erro do
// agente — a varredura simplesmente nao roda naquele ciclo.
var ErrNoPrimaryIPv4 = errors.New("nenhum IPv4 primario encontrado")

// ParseIPv4 valida e devolve os 4 octetos de um IPv4 em notacao decimal
// pontuada. Funcao pura, sem I/O — e' o nucleo testavel do calculo de /24.
func ParseIPv4(ip string) ([4]int, error) {
	var octets [4]int

	parts := strings.Split(strings.TrimSpace(ip), ".")
	if len(parts) != 4 {
		return octets, fmt.Errorf("IPv4 invalido: %q", ip)
	}

	for i, part := range parts {
		if part == "" || len(part) > 3 {
			return octets, fmt.Errorf("IPv4 invalido: %q", ip)
		}
		value, err := strconv.Atoi(part)
		if err != nil || value < 0 || value > 255 {
			return octets, fmt.Errorf("IPv4 invalido: %q", ip)
		}
		octets[i] = value
	}

	return octets, nil
}

// Slash24 devolve a notacao CIDR da /24 que contem o IP informado
// (ex: "192.168.1.37" -> "192.168.1.0/24").
//
// A varredura assume /24 SEMPRE, sem consultar a mascara real da interface.
// E' uma simplificacao deliberada: cobre a esmagadora maioria das LANs de
// escritorio, mantem o custo do ciclo previsivel (254 hosts, nao 65 mil de uma
// /16) e nunca varre alem do segmento imediato da maquina.
func Slash24(ip string) (string, error) {
	octets, err := ParseIPv4(ip)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%d.%d.%d.0/24", octets[0], octets[1], octets[2]), nil
}

// HostsInSlash24 devolve os enderecos varreveis da /24 que contem o IP
// informado: 1..254, excluindo o endereco de rede (.0), o de broadcast (.255)
// e o PROPRIO IP da maquina — essa maquina ja e' inventariada pelo check-in,
// e se aparecesse aqui viraria um "dispositivo descoberto" duplicado do
// proprio agente.
func HostsInSlash24(ip string) ([]string, error) {
	octets, err := ParseIPv4(ip)
	if err != nil {
		return nil, err
	}

	hosts := make([]string, 0, 253)
	for last := 1; last <= 254; last++ {
		if last == octets[3] {
			continue
		}
		hosts = append(hosts, fmt.Sprintf("%d.%d.%d.%d", octets[0], octets[1], octets[2], last))
	}

	return hosts, nil
}

// PrimaryIPv4 descobre o IPv4 da interface primaria da maquina.
//
// Percorre as interfaces de rede reais em vez de "discar" para um endereco
// externo: o agente roda como servico em maquinas que podem estar sem rota
// default (rede isolada de laboratorio, por exemplo), e nesse caso o truque do
// UDP dial falharia mesmo havendo uma LAN valida para varrer.
//
// Interfaces DOWN, loopback e enderecos link-local (169.254.0.0/16 — APIPA,
// que indica DHCP falho, nao uma LAN de verdade) sao ignorados.
func PrimaryIPv4() (string, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ipv4 := ipNet.IP.To4()
			if ipv4 == nil || ipv4.IsLoopback() || ipv4.IsLinkLocalUnicast() {
				continue
			}
			return ipv4.String(), nil
		}
	}

	return "", ErrNoPrimaryIPv4
}
