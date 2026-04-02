//go:build windows

package windowscollector

import (
	"strings"
	"time"

	"inventario-agent/internal/domain/inventory"

	"golang.org/x/sys/windows/registry"
)

func collectSoftwareFromRegistry() []inventory.SoftwareInfo {
	paths := []string{
		`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
		`SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`,
	}

	seen := make(map[string]bool)
	var result []inventory.SoftwareInfo

	for _, path := range paths {
		key, err := registry.OpenKey(registry.LOCAL_MACHINE, path, registry.READ)
		if err != nil {
			continue
		}

		subkeys, err := key.ReadSubKeyNames(-1)
		if err != nil {
			key.Close()
			continue
		}

		for _, subkey := range subkeys {
			itemKey, err := registry.OpenKey(key, subkey, registry.READ)
			if err != nil {
				continue
			}

			name, _, err := itemKey.GetStringValue("DisplayName")
			if err != nil || strings.TrimSpace(name) == "" {
				itemKey.Close()
				continue
			}

			name = strings.TrimSpace(name)
			if seen[name] {
				itemKey.Close()
				continue
			}
			seen[name] = true

			version, _, _ := itemKey.GetStringValue("DisplayVersion")
			publisher, _, _ := itemKey.GetStringValue("Publisher")
			installDate, _, _ := itemKey.GetStringValue("InstallDate")
			itemKey.Close()

			software := inventory.SoftwareInfo{
				Nome:   name,
				Versao: strings.TrimSpace(version),
				Editor: strings.TrimSpace(publisher),
			}

			if len(installDate) == 8 {
				if parsed, err := time.Parse("20060102", installDate); err == nil {
					software.InstaladoEm = parsed.Format(time.RFC3339)
				}
			}

			result = append(result, software)
		}

		key.Close()
	}

	return result
}
