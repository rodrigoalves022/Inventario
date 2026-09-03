package discovery

import "testing"

// Sprint 14. Cobre APENAS as funcoes puras do pacote — as que decidem alguma
// coisa a partir de dados, sem tocar a rede: calculo da /24, classificacao de
// tipo, montagem de openPorts, parse de `arp -a` e resolucao de fabricante.
// O I/O (probe TCP, GET SNMP, exec de `arp -a`) fica de fora de proposito:
// testa-lo exigiria um dispositivo de rede real ou um servidor falso, o que
// nao prova nada sobre a logica que erra de verdade.

func TestParseIPv4(t *testing.T) {
	valid := []string{"192.168.1.1", "10.0.0.254", "0.0.0.0", "255.255.255.255"}
	for _, ip := range valid {
		if _, err := ParseIPv4(ip); err != nil {
			t.Errorf("ParseIPv4(%q) devolveu erro inesperado: %v", ip, err)
		}
	}

	invalid := []string{"", "192.168.1", "192.168.1.1.1", "192.168.1.256", "192.168.1.-1", "a.b.c.d", "192.168.01.1000"}
	for _, ip := range invalid {
		if _, err := ParseIPv4(ip); err == nil {
			t.Errorf("ParseIPv4(%q) deveria ter falhado", ip)
		}
	}
}

func TestSlash24(t *testing.T) {
	cases := map[string]string{
		"192.168.1.37": "192.168.1.0/24",
		"10.62.1.1":    "10.62.1.0/24",
		"172.16.5.254": "172.16.5.0/24",
	}

	for input, expected := range cases {
		got, err := Slash24(input)
		if err != nil {
			t.Fatalf("Slash24(%q): erro inesperado: %v", input, err)
		}
		if got != expected {
			t.Errorf("Slash24(%q) = %q, esperado %q", input, got, expected)
		}
	}

	if _, err := Slash24("nao-e-um-ip"); err == nil {
		t.Error("Slash24 deveria rejeitar entrada invalida")
	}
}

func TestHostsInSlash24(t *testing.T) {
	hosts, err := HostsInSlash24("192.168.1.37")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	// 254 hosts utilizaveis (1..254) menos o proprio IP da maquina.
	if len(hosts) != 253 {
		t.Fatalf("esperado 253 hosts, obtido %d", len(hosts))
	}

	index := make(map[string]bool, len(hosts))
	for _, host := range hosts {
		index[host] = true
	}

	if index["192.168.1.37"] {
		t.Error("o proprio IP da maquina nao deve entrar na varredura")
	}
	if index["192.168.1.0"] {
		t.Error("endereco de rede (.0) nao deve ser varrido")
	}
	if index["192.168.1.255"] {
		t.Error("endereco de broadcast (.255) nao deve ser varrido")
	}
	if !index["192.168.1.1"] || !index["192.168.1.254"] {
		t.Error("as bordas da faixa utilizavel (.1 e .254) devem ser varridas")
	}
}

func TestFormatOpenPorts(t *testing.T) {
	cases := []struct {
		name     string
		ports    []int
		expected string
	}{
		{"vazio vira string vazia (servidor grava NULL)", nil, ""},
		{"ordena crescente", []int{9100, 80, 161}, "80,161,9100"},
		{"deduplica", []int{80, 80, 443}, "80,443"},
		{"ignora porta invalida", []int{0, -1, 22}, "22"},
		{"porta unica", []int{445}, "445"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := FormatOpenPorts(testCase.ports); got != testCase.expected {
				t.Errorf("FormatOpenPorts(%v) = %q, esperado %q", testCase.ports, got, testCase.expected)
			}
		})
	}
}

func TestClassifyDeviceBySysDescr(t *testing.T) {
	cases := []struct {
		name     string
		signals  Signals
		expected string
	}{
		{
			name:     "sysDescr de impressora HP",
			signals:  Signals{SNMPResponded: true, SysDescr: "HP ETHERNET MULTI-ENVIRONMENT,ROM none,JETDIRECT,JD153"},
			expected: TypePrinter,
		},
		{
			name:     "sysDescr Cisco IOS => switch",
			signals:  Signals{SNMPResponded: true, SysDescr: "Cisco IOS Software, C2960 Software"},
			expected: TypeSwitch,
		},
		{
			name:     "sysDescr MikroTik RouterOS => roteador",
			signals:  Signals{SNMPResponded: true, SysDescr: "RouterOS RB750Gr3"},
			expected: TypeRouter,
		},
		{
			name:     "sysDescr Synology => NAS",
			signals:  Signals{SNMPResponded: true, SysDescr: "Linux DiskStation 4.4.180+ #42962 SMP Synology"},
			expected: TypeNAS,
		},
		{
			name:     "sysDescr de access point Ubiquiti",
			signals:  Signals{SNMPResponded: true, SysDescr: "UniFi AP-AC-Lite 6.0.21"},
			expected: TypeAccessPoint,
		},
		{
			name:     "sysName tambem alimenta a classificacao",
			signals:  Signals{SNMPResponded: true, SysName: "sw-core-01-procurve"},
			expected: TypeSwitch,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := ClassifyDevice(testCase.signals); got != testCase.expected {
				t.Errorf("ClassifyDevice = %q, esperado %q", got, testCase.expected)
			}
		})
	}
}

func TestClassifyDeviceByPorts(t *testing.T) {
	cases := []struct {
		name     string
		signals  Signals
		expected string
	}{
		{
			name:     "porta 9100 sozinha => impressora",
			signals:  Signals{OpenTCPPorts: []int{9100}},
			expected: TypePrinter,
		},
		{
			name:     "porta 515 (LPD) => impressora",
			signals:  Signals{OpenTCPPorts: []int{515}},
			expected: TypePrinter,
		},
		{
			name:     "porta 631 (IPP) => impressora",
			signals:  Signals{OpenTCPPorts: []int{80, 631}},
			expected: TypePrinter,
		},
		{
			name:     "porta 445 sozinha => NAS",
			signals:  Signals{OpenTCPPorts: []int{445}},
			expected: TypeNAS,
		},
		{
			name:     "so portas fracas (80/443/22) => nao identificado",
			signals:  Signals{OpenTCPPorts: []int{22, 80, 443}},
			expected: TypeUnknown,
		},
		{
			name:     "nenhum sinal => nao identificado",
			signals:  Signals{},
			expected: TypeUnknown,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := ClassifyDevice(testCase.signals); got != testCase.expected {
				t.Errorf("ClassifyDevice = %q, esperado %q", got, testCase.expected)
			}
		})
	}
}

// O caso que a precedencia existe para resolver.
func TestClassifyDeviceSinaisConflitantes(t *testing.T) {
	t.Run("9100 E 445 abertos => PRINTER (porta de impressao e' sinal forte, SMB e' fraco)", func(t *testing.T) {
		got := ClassifyDevice(Signals{OpenTCPPorts: []int{445, 9100}})
		if got != TypePrinter {
			t.Errorf("ClassifyDevice = %q, esperado %q", got, TypePrinter)
		}
	})

	t.Run("sysDescr vence porta: NAS com 9100 aberto continua NAS", func(t *testing.T) {
		got := ClassifyDevice(Signals{
			OpenTCPPorts:  []int{445, 9100},
			SNMPResponded: true,
			SysDescr:      "Synology DiskStation DS220+",
		})
		if got != TypeNAS {
			t.Errorf("ClassifyDevice = %q, esperado %q", got, TypeNAS)
		}
	})

	t.Run("SNMP responde mas sysDescr nao casa nada => UNKNOWN, nunca SWITCH chutado", func(t *testing.T) {
		got := ClassifyDevice(Signals{SNMPResponded: true, SysDescr: "APC Smart-UPS 1500 firmware 9.2"})
		if got != TypeUnknown {
			t.Errorf("ClassifyDevice = %q, esperado %q", got, TypeUnknown)
		}
	})
}

func TestParseARPOutput(t *testing.T) {
	// Saida real do `arp -a` do Windows em pt-BR, com duas interfaces.
	output := "\r\n" +
		"Interface: 192.168.1.37 --- 0xb\r\n" +
		"  Endereço IP           Endereço físico      Tipo\r\n" +
		"  192.168.1.1           d4-6e-0e-11-22-33    dinâmico\r\n" +
		"  192.168.1.50          00-1b-78-aa-bb-cc    dinâmico\r\n" +
		"  192.168.1.255         ff-ff-ff-ff-ff-ff    estático\r\n" +
		"  224.0.0.22            01-00-5e-00-00-16    estático\r\n" +
		"\r\n" +
		"Interface: 10.0.0.5 --- 0x4\r\n" +
		"  Endereço IP           Endereço físico      Tipo\r\n" +
		"  10.0.0.1              aa:bb:cc:dd:ee:ff    dinâmico\r\n"

	table := ParseARPOutput(output)

	if len(table) != 3 {
		t.Fatalf("esperado 3 entradas fisicas, obtido %d: %v", len(table), table)
	}
	if table["192.168.1.1"] != "D4:6E:0E:11:22:33" {
		t.Errorf("MAC normalizado incorreto: %q", table["192.168.1.1"])
	}
	if table["192.168.1.50"] != "00:1B:78:AA:BB:CC" {
		t.Errorf("MAC normalizado incorreto: %q", table["192.168.1.50"])
	}
	if table["10.0.0.1"] != "AA:BB:CC:DD:EE:FF" {
		t.Errorf("a segunda interface tambem deve ser lida: %q", table["10.0.0.1"])
	}
	if _, exists := table["192.168.1.255"]; exists {
		t.Error("broadcast (ff-ff-...) nao deve virar dispositivo")
	}
	if _, exists := table["224.0.0.22"]; exists {
		t.Error("multicast (01-00-5e-...) nao deve virar dispositivo")
	}
}

func TestParseARPOutputEntradasInvalidas(t *testing.T) {
	table := ParseARPOutput("lixo\n\n   \nInterface: nada\n999.1.1.1 aa-bb-cc-dd-ee-ff\n1.2.3.4 nao-e-mac\n")
	if len(table) != 0 {
		t.Errorf("nenhuma linha invalida deveria virar entrada, obtido: %v", table)
	}
}

func TestNormalizeMAC(t *testing.T) {
	cases := map[string]string{
		"d4-6e-0e-11-22-33": "D4:6E:0E:11:22:33",
		"D4:6E:0E:11:22:33": "D4:6E:0E:11:22:33",
		"  aa-bb-cc-dd-ee-ff  ": "AA:BB:CC:DD:EE:FF",
		"aa-bb-cc-dd-ee":       "",
		"zz-bb-cc-dd-ee-ff":    "",
		"":                     "",
	}

	for input, expected := range cases {
		if got := NormalizeMAC(input); got != expected {
			t.Errorf("NormalizeMAC(%q) = %q, esperado %q", input, got, expected)
		}
	}
}

func TestResolveVendor(t *testing.T) {
	t.Run("SNMP tem prioridade sobre a tabela OUI", func(t *testing.T) {
		// MAC de prefixo HP, mas o dispositivo se declara MikroTik.
		got := ResolveVendor("RouterOS 6.48 MikroTik", "", "00:1B:78:11:22:33")
		if got != "MikroTik" {
			t.Errorf("ResolveVendor = %q, esperado MikroTik", got)
		}
	})

	t.Run("sem SNMP, cai na tabela OUI pequena", func(t *testing.T) {
		if got := ResolveVendor("", "", "00-1b-78-11-22-33"); got != "HP" {
			t.Errorf("ResolveVendor = %q, esperado HP", got)
		}
	})

	t.Run("sem SNMP e sem match de OUI => vazio (servidor grava NULL)", func(t *testing.T) {
		if got := ResolveVendor("", "", "12:34:56:78:9A:BC"); got != "" {
			t.Errorf("ResolveVendor = %q, esperado string vazia", got)
		}
	})

	t.Run("MAC ausente nao quebra", func(t *testing.T) {
		if got := ResolveVendor("", "", ""); got != "" {
			t.Errorf("ResolveVendor = %q, esperado string vazia", got)
		}
	})
}
