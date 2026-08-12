//go:build windows

package windowscollector

import (
	"os"
	"strings"

	"inventario-agent/internal/domain/inventory"

	"github.com/yusufpapurcu/wmi"
	"golang.org/x/sys/windows/registry"
)

type securityCenterProduct struct {
	DisplayName  string
	ProductState uint32
}

type win32Tpm struct {
	IsEnabled_InitialValue  bool
	IsActivated_InitialValue bool
}

type win32EncryptableVolume struct {
	DriveLetter      string
	ProtectionStatus uint32
}

type win32UserAccount struct {
	Name        string
	Disabled    bool
	PasswordExpires bool
	SID         string
}

type win32GroupUser struct {
	GroupComponent string
	PartComponent  string
}

func boolPtr(value bool) *bool { return &value }

// hostnameForWmi devolve o nome da maquina no formato que o WMI usa nos
// caminhos de objeto (sempre maiusculo, sem dominio).
func hostnameForWmi() string {
	name, err := os.Hostname()
	if err != nil {
		return ""
	}
	if index := strings.Index(name, "."); index != -1 {
		name = name[:index]
	}
	return strings.ToUpper(name)
}

// decodeProductState interpreta o bitfield do SecurityCenter2.
// Byte do meio indica se esta habilitado; o ultimo byte, se as assinaturas
// estao atualizadas. E a leitura consagrada da API, que a Microsoft nunca
// documentou formalmente.
func decodeProductState(state uint32) (enabled bool, upToDate bool) {
	enabled = state&0x1000 != 0
	upToDate = state&0x10 == 0
	return enabled, upToDate
}

func readRegistryDword(root registry.Key, path string, name string) (uint64, bool) {
	key, err := registry.OpenKey(root, path, registry.QUERY_VALUE)
	if err != nil {
		return 0, false
	}
	defer key.Close()

	value, _, err := key.GetIntegerValue(name)
	if err != nil {
		return 0, false
	}
	return value, true
}

// collectSecurity apura a postura de seguranca do endpoint.
//
// Campos ficam nil quando nao foi possivel apurar — nunca false. Reportar
// desconhecido como desativado produziria alarme falso de compliance, que e
// pior do que a ausencia do dado.
func collectSecurity() *inventory.SecurityInfo {
	info := &inventory.SecurityInfo{}
	var notes []string

	// SecurityCenter2 so existe em SKUs cliente do Windows. Em Server o
	// namespace nao e registrado, entao antivirus/firewall ficam indeterminados
	// mesmo havendo Defender ativo.
	var antivirus []securityCenterProduct
	avErr := wmi.QueryNamespace(
		"SELECT DisplayName, ProductState FROM AntiVirusProduct",
		&antivirus,
		`root\SecurityCenter2`,
	)

	switch {
	case avErr != nil:
		notes = append(notes, "antivirus nao apurado: namespace SecurityCenter2 indisponivel (tipico em Windows Server)")
	case len(antivirus) == 0:
		notes = append(notes, "nenhum antivirus registrado no Security Center")
	default:
		info.AntivirusNome = strings.TrimSpace(antivirus[0].DisplayName)
		enabled, upToDate := decodeProductState(antivirus[0].ProductState)
		info.AntivirusAtivo = boolPtr(enabled)
		info.AntivirusAtualizado = boolPtr(upToDate)
	}

	// Firewall: preferimos o registro, que responde em Server e em cliente.
	// Basta um perfil ativo para considerar o firewall ligado.
	firewallProfiles := []string{
		`SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\DomainProfile`,
		`SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\StandardProfile`,
		`SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\PublicProfile`,
	}
	firewallKnown := false
	firewallOn := false
	for _, profile := range firewallProfiles {
		if value, ok := readRegistryDword(registry.LOCAL_MACHINE, profile, "EnableFirewall"); ok {
			firewallKnown = true
			if value == 1 {
				firewallOn = true
			}
		}
	}
	if firewallKnown {
		info.FirewallAtivo = boolPtr(firewallOn)
	} else {
		notes = append(notes, "firewall nao apurado: chaves de perfil ausentes")
	}

	// Secure Boot: chave presente apenas em maquinas UEFI.
	if value, ok := readRegistryDword(
		registry.LOCAL_MACHINE,
		`SYSTEM\CurrentControlSet\Control\SecureBoot\State`,
		"UEFISecureBootEnabled",
	); ok {
		info.SecureBootAtivo = boolPtr(value == 1)
	} else {
		notes = append(notes, "secure boot nao apurado: maquina possivelmente em modo legado/BIOS")
	}

	// UAC
	if value, ok := readRegistryDword(
		registry.LOCAL_MACHINE,
		`SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`,
		"EnableLUA",
	); ok {
		info.UacAtivo = boolPtr(value == 1)
	}

	// TPM exige privilegio elevado; como servico roda em LocalSystem, funciona.
	var tpm []win32Tpm
	if err := wmi.QueryNamespace(
		"SELECT IsEnabled_InitialValue, IsActivated_InitialValue FROM Win32_Tpm",
		&tpm,
		`root\CIMV2\Security\MicrosoftTpm`,
	); err == nil && len(tpm) > 0 {
		info.TpmPresente = boolPtr(tpm[0].IsEnabled_InitialValue)
	} else {
		notes = append(notes, "tpm nao apurado")
	}

	if len(notes) > 0 {
		info.Observacao = strings.Join(notes, "; ")
		if len(info.Observacao) > 500 {
			info.Observacao = info.Observacao[:500]
		}
	}

	return info
}

// collectDiskEncryption devolve o estado do BitLocker por letra de unidade.
// Mapa vazio significa que a consulta falhou — o chamador deve deixar o campo
// em branco em vez de assumir volume desprotegido.
func collectDiskEncryption() map[string]string {
	result := make(map[string]string)

	var volumes []win32EncryptableVolume
	if err := wmi.QueryNamespace(
		"SELECT DriveLetter, ProtectionStatus FROM Win32_EncryptableVolume",
		&volumes,
		`root\CIMV2\Security\MicrosoftVolumeEncryption`,
	); err != nil {
		return result
	}

	for _, volume := range volumes {
		letter := strings.ToUpper(strings.TrimSpace(volume.DriveLetter))
		if letter == "" {
			continue
		}
		switch volume.ProtectionStatus {
		case 1:
			result[letter] = "on"
		case 0:
			result[letter] = "off"
		default:
			result[letter] = "unknown"
		}
	}

	return result
}

// maxLocalAccounts protege contra enumerar diretorio inteiro caso o filtro
// LocalAccount=True deixe de ser respeitado por alguma versao do WMI.
const maxLocalAccounts = 200

// collectLocalAccounts lista contas LOCAIS e marca quais sao administradoras.
//
// O filtro LocalAccount=True e essencial: num controlador de dominio,
// Win32_UserAccount sem filtro devolve toda a base do Active Directory, o que
// jogaria milhares de contas de funcionarios dentro do inventario. Num DC o
// resultado correto e lista vazia — nao existem contas locais.
//
// Devolve tambem uma observacao explicando um resultado vazio, para o painel
// nao confundir "nenhuma conta local" com "coleta falhou".
func collectLocalAccounts() ([]inventory.LocalAccountInfo, string) {
	var accounts []win32UserAccount
	if err := wmi.Query(
		"SELECT Name, Disabled, PasswordExpires, SID FROM Win32_UserAccount WHERE LocalAccount=True",
		&accounts,
	); err != nil {
		return nil, "contas locais nao apuradas: consulta WMI falhou"
	}

	if len(accounts) == 0 {
		return nil, "nenhuma conta local (esperado em controlador de dominio, onde todas as contas sao de dominio)"
	}

	adminNames := localAdministrators()

	result := make([]inventory.LocalAccountInfo, 0, len(accounts))
	for _, account := range accounts {
		if len(result) >= maxLocalAccounts {
			return result, "lista de contas locais truncada no limite de seguranca"
		}
		name := strings.TrimSpace(account.Name)
		if name == "" {
			continue
		}
		result = append(result, inventory.LocalAccountInfo{
			Usuario: name,
			IsAdmin: adminNames[strings.ToLower(name)],
			// WMI: PasswordExpires=true significa que a senha EXPIRA.
			Habilitada:       !account.Disabled,
			SenhaNuncaExpira: !account.PasswordExpires,
		})
	}

	return result, ""
}

// localAdministrators resolve os membros do grupo Administradores.
// O nome do grupo e localizado (Administradores em pt-BR), entao identificamos
// pelo SID conhecido S-1-5-32-544 em vez do nome.
func localAdministrators() map[string]bool {
	admins := make(map[string]bool)

	var groups []struct {
		Name string
		SID  string
	}
	if err := wmi.Query("SELECT Name, SID FROM Win32_Group WHERE LocalAccount=True", &groups); err != nil {
		return admins
	}

	groupName := ""
	for _, group := range groups {
		if group.SID == "S-1-5-32-544" {
			groupName = group.Name
			break
		}
	}
	if groupName == "" {
		return admins
	}

	var members []win32GroupUser
	query := "SELECT GroupComponent, PartComponent FROM Win32_GroupUser WHERE GroupComponent=\"Win32_Group.Domain='" +
		hostnameForWmi() + "',Name='" + groupName + "'\""
	if err := wmi.Query(query, &members); err != nil {
		return admins
	}

	for _, member := range members {
		// PartComponent vem como: \\HOST\root\cimv2:Win32_UserAccount.Domain="HOST",Name="admin"
		part := member.PartComponent
		index := strings.LastIndex(part, "Name=\"")
		if index == -1 {
			continue
		}
		name := part[index+len("Name=\""):]
		name = strings.TrimSuffix(name, "\"")
		name = strings.Trim(name, "\"")
		if name != "" {
			admins[strings.ToLower(name)] = true
		}
	}

	return admins
}
