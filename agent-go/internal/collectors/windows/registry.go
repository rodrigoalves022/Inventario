//go:build windows

package windowscollector

import (
	"regexp"
	"strings"
	"time"

	"inventario-agent/internal/domain/inventory"

	"golang.org/x/sys/windows/registry"
)

// registrySoftwareRaw reúne os valores de uma chave Uninstall relevantes para
// decidir se o item aparece em "Programas e Recursos" (appwiz.cpl).
type registrySoftwareRaw struct {
	DisplayName          string
	DisplayVersion       string
	Publisher            string
	InstallDate          string
	UninstallString      string
	QuietUninstallString string
	ParentKeyName        string
	ParentDisplayName    string
	ReleaseType          string
	SystemComponent      uint64
	NoDisplay            uint64
}

var internalSoftwarePattern = regexp.MustCompile(
	`(?i)^(vs_|vcpp_crt\.|application verifier |windows sdk for windows store |windows team extension sdk|definition update for )`,
)

// shouldIncludeRegistrySoftware replica as regras do Painel de Controle.
func shouldIncludeRegistrySoftware(raw registrySoftwareRaw) bool {
	name := strings.TrimSpace(raw.DisplayName)
	if name == "" {
		return false
	}
	if raw.SystemComponent == 1 || raw.NoDisplay == 1 {
		return false
	}
	if strings.TrimSpace(raw.ParentKeyName) != "" || strings.TrimSpace(raw.ParentDisplayName) != "" {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(raw.ReleaseType)) {
	case "update", "security update", "hotfix", "update rollup", "servicepack":
		return false
	}
	if strings.TrimSpace(raw.UninstallString) == "" && strings.TrimSpace(raw.QuietUninstallString) == "" {
		return false
	}
	return !internalSoftwarePattern.MatchString(name)
}

func readRegistrySoftware(key registry.Key) registrySoftwareRaw {
	str := func(name string) string {
		v, _, _ := key.GetStringValue(name)
		return v
	}
	num := func(name string) uint64 {
		v, _, _ := key.GetIntegerValue(name)
		return v
	}
	return registrySoftwareRaw{
		DisplayName:          str("DisplayName"),
		DisplayVersion:       str("DisplayVersion"),
		Publisher:            str("Publisher"),
		InstallDate:          str("InstallDate"),
		UninstallString:      str("UninstallString"),
		QuietUninstallString: str("QuietUninstallString"),
		ParentKeyName:        str("ParentKeyName"),
		ParentDisplayName:    str("ParentDisplayName"),
		ReleaseType:          str("ReleaseType"),
		SystemComponent:      num("SystemComponent"),
		NoDisplay:            num("NoDisplay"),
	}
}

func toSoftwareInfo(raw registrySoftwareRaw) inventory.SoftwareInfo {
	software := inventory.SoftwareInfo{
		Nome:   strings.TrimSpace(raw.DisplayName),
		Versao: strings.TrimSpace(raw.DisplayVersion),
		Editor: strings.TrimSpace(raw.Publisher),
	}
	if len(raw.InstallDate) == 8 {
		if parsed, err := time.Parse("20060102", raw.InstallDate); err == nil {
			software.InstaladoEm = parsed.Format(time.RFC3339)
		}
	}
	return software
}

// addRegistrySoftware deduplica por nome normalizado; se o item já visto não
// tinha versão e este tem, atualiza.
func addRegistrySoftware(raw registrySoftwareRaw, index map[string]int, result *[]inventory.SoftwareInfo) {
	if !shouldIncludeRegistrySoftware(raw) {
		return
	}
	key := strings.ToLower(strings.TrimSpace(raw.DisplayName))
	if i, ok := index[key]; ok {
		if (*result)[i].Versao == "" && strings.TrimSpace(raw.DisplayVersion) != "" {
			(*result)[i] = toSoftwareInfo(raw)
		}
		return
	}
	index[key] = len(*result)
	*result = append(*result, toSoftwareInfo(raw))
}

func scanUninstallKey(root registry.Key, path string, index map[string]int, result *[]inventory.SoftwareInfo) {
	key, err := registry.OpenKey(root, path, registry.READ)
	if err != nil {
		return
	}
	defer key.Close()

	subkeys, err := key.ReadSubKeyNames(-1)
	if err != nil {
		return
	}
	for _, subkey := range subkeys {
		itemKey, err := registry.OpenKey(key, subkey, registry.READ)
		if err != nil {
			continue
		}
		raw := readRegistrySoftware(itemKey)
		itemKey.Close()
		addRegistrySoftware(raw, index, result)
	}
}

func collectSoftwareFromRegistry() []inventory.SoftwareInfo {
	paths := []string{
		`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
		`SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`,
	}

	index := make(map[string]int)
	var result []inventory.SoftwareInfo

	for _, path := range paths {
		scanUninstallKey(registry.LOCAL_MACHINE, path, index, &result)
	}

	// Apps por usuário (VS Code, GitHub Desktop, Python...) ficam em HKU\<SID>.
	if users, err := registry.OpenKey(registry.USERS, ``, registry.READ); err == nil {
		sids, _ := users.ReadSubKeyNames(-1)
		users.Close()
		for _, sid := range sids {
			if !strings.HasPrefix(sid, "S-1-5-21-") || strings.HasSuffix(sid, "_Classes") {
				continue
			}
			for _, path := range paths {
				scanUninstallKey(registry.USERS, sid+`\`+path, index, &result)
			}
		}
	}

	return result
}
