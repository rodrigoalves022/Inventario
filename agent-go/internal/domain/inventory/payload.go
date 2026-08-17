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
