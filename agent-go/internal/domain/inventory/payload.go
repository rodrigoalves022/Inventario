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
}

type SoftwareInfo struct {
	Nome        string `json:"nome"`
	Versao      string `json:"versao,omitempty"`
	Editor      string `json:"editor,omitempty"`
	InstaladoEm string `json:"installadoEm,omitempty"`
}
