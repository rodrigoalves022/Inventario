package inventory

// Payload representa a estrutura de dados enviada ao servidor.
type Payload struct {
	Hostname          string         `json:"hostname"`
	AgentVersion      string         `json:"agentVersion,omitempty"`
	Serial            string         `json:"serial,omitempty"`
	Fabricante        string         `json:"fabricante,omitempty"`
	Modelo            string         `json:"modelo,omitempty"`
	Dominio           string         `json:"dominio,omitempty"`
	Usuario           string         `json:"usuario,omitempty"`
	Sistema           string         `json:"sistema,omitempty"`
	VersaoSO          string         `json:"versaoSO,omitempty"`
	Processador       string         `json:"processador,omitempty"`
	RamTotalGb        int            `json:"ramTotalGb,omitempty"`
	Slot1             string         `json:"slot1,omitempty"`
	Slot2             string         `json:"slot2,omitempty"`
	Slot3             string         `json:"slot3,omitempty"`
	Slot4             string         `json:"slot4,omitempty"`
	PlacaMae          string         `json:"placaMae,omitempty"`
	TipoArmazenamento string         `json:"tipoArmazenamento,omitempty"`
	Redes             []NetworkInfo  `json:"redes,omitempty"`
	Discos            []DiskInfo     `json:"discos,omitempty"`
	Software          []SoftwareInfo `json:"software,omitempty"`
	Seguranca         *SecurityInfo  `json:"seguranca,omitempty"`
	ContasLocais      []LocalAccountInfo `json:"contasLocais,omitempty"`
	Monitores         []MonitorInfo      `json:"monitores,omitempty"`
	Impressoras       []PrinterInfo      `json:"impressoras,omitempty"`
	DispositivosUsb   []UsbDeviceInfo    `json:"dispositivosUsb,omitempty"`
}

// SecurityInfo usa ponteiros de proposito: nil significa "nao foi possivel
// apurar", que e diferente de false ("apurado e desativado"). Reportar um
// desconhecido como desativado geraria alarme falso de compliance.
type SecurityInfo struct {
	AntivirusNome       string  `json:"antivirusNome,omitempty"`
	AntivirusAtivo      *bool   `json:"antivirusAtivo,omitempty"`
	AntivirusAtualizado *bool   `json:"antivirusAtualizado,omitempty"`
	FirewallAtivo       *bool   `json:"firewallAtivo,omitempty"`
	SecureBootAtivo     *bool   `json:"secureBootAtivo,omitempty"`
	TpmPresente         *bool   `json:"tpmPresente,omitempty"`
	UacAtivo            *bool   `json:"uacAtivo,omitempty"`
	Observacao          string  `json:"observacao,omitempty"`
}

// MetricsPayload e' a amostra leve enviada a cada ~10 min, separada do
// Payload completo (que roda a cada 1h). Ponteiros de proposito: nil
// significa "nao apurado nesta amostra", nunca 0 — 0% de CPU livre pareceria
// uma maquina ociosa em vez de um dado ausente.
type MetricsPayload struct {
	Hostname       string   `json:"hostname"`
	AgentVersion   string   `json:"agentVersion,omitempty"`
	CpuPercent     *float64 `json:"cpuPercent,omitempty"`
	RamUsadaGb     *float64 `json:"ramUsadaGb,omitempty"`
	RamTotalGb     *float64 `json:"ramTotalGb,omitempty"`
	DiscoUsadoGb   *float64 `json:"discoUsadoGb,omitempty"`
	DiscoLivreGb   *float64 `json:"discoLivreGb,omitempty"`
	UptimeSegundos *int64   `json:"uptimeSegundos,omitempty"`
}

// DiscoveryPayload e' o resultado da varredura de descoberta de rede (ciclo de
// 6h, o mais espacado e mais caro do agente). Nao tem nada a ver com Payload/
// MetricsPayload: aqueles descrevem a PROPRIA maquina; este descreve
// dispositivos de terceiros na LAN, que nao tem agente instalado.
//
// `Devices` com omitempty: slice nil vira campo ausente no JSON, e o schema Zod
// do servidor aplica o default []. Enviar `null` seria rejeitado com 400.
type DiscoveryPayload struct {
	Hostname     string             `json:"hostname"`
	AgentVersion string             `json:"agentVersion,omitempty"`
	Subnet       string             `json:"subnet,omitempty"`
	Devices      []DiscoveredDevice `json:"devices,omitempty"`
}

// DiscoveredDevice e' UM dispositivo achado na varredura. Todo campo textual
// usa omitempty: string vazia significa "nao apurado" e vira NULL no servidor,
// nunca "" gravado como se fosse um valor.
type DiscoveredDevice struct {
	IP           string `json:"ip"`
	Mac          string `json:"mac,omitempty"`
	Hostname     string `json:"hostname,omitempty"`
	Vendor       string `json:"vendor,omitempty"`
	DeviceType   string `json:"deviceType"`
	SnmpSysDescr string `json:"snmpSysDescr,omitempty"`
	OpenPorts    string `json:"openPorts,omitempty"`
}

type LocalAccountInfo struct {
	Usuario          string `json:"usuario"`
	IsAdmin          bool   `json:"isAdmin"`
	Habilitada       bool   `json:"habilitada"`
	SenhaNuncaExpira bool   `json:"senhaNuncaExpira"`
}

type NetworkInfo struct {
	IP        string `json:"ip,omitempty"`
	MAC       string `json:"mac,omitempty"`
	Gateway   string `json:"gateway,omitempty"`
	DNS       string `json:"dns,omitempty"`
	DHCP      bool   `json:"dhcp"`
	IsPrimary bool   `json:"isPrimary"`
}

type DiskInfo struct {
	Unidade       string `json:"unidade,omitempty"`
	Modelo        string `json:"modelo,omitempty"`
	Tipo          string `json:"tipo,omitempty"`
	CapacidadeGb  int    `json:"capacidadeGb,omitempty"`
	EspacoLivreGb int    `json:"espacoLivreGb,omitempty"`
	// "on" | "off" | "unknown" — vazio quando nao consultado.
	Criptografia  string `json:"criptografia,omitempty"`
}

type SoftwareInfo struct {
	Nome        string `json:"nome"`
	Versao      string `json:"versao,omitempty"`
	Editor      string `json:"editor,omitempty"`
	InstaladoEm string `json:"installadoEm,omitempty"`
}

// MonitorInfo vem do EDID (WmiMonitorID/WmiMonitorBasicDisplayParams, root\wmi),
// nao de Win32_DesktopMonitor, que nao expoe fabricante/serie reais. Campos
// ficam vazios/zero quando o monitor nao reporta EDID (conexao analogica
// antiga, monitor virtual de RDP) — nunca inventados.
type MonitorInfo struct {
	Fabricante string  `json:"fabricante,omitempty"`
	Modelo     string  `json:"modelo,omitempty"`
	Serial     string  `json:"serial,omitempty"`
	Polegadas  float64 `json:"polegadas,omitempty"`
	Conexao    string  `json:"conexao,omitempty"`
	Ano        int     `json:"ano,omitempty"`
}

type PrinterInfo struct {
	Nome    string `json:"nome"`
	Porta   string `json:"porta,omitempty"`
	Driver  string `json:"driver,omitempty"`
	Padrao  bool   `json:"padrao"`
	DeRede  bool   `json:"deRede"`
}

// UsbDeviceInfo identifica dispositivos USB reais (hubs sao filtrados na
// coleta). VendorId/ProductId/Serial vem do DeviceID do Windows
// (USB\VID_xxxx&PID_xxxx\serial) — ficam vazios quando o formato foge do
// padrao esperado.
type UsbDeviceInfo struct {
	Nome      string `json:"nome"`
	VendorId  string `json:"vendorId,omitempty"`
	ProductId string `json:"productId,omitempty"`
	Serial    string `json:"serial,omitempty"`
}
