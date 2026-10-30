//go:build windows

package anydesk

import (
	"os"
	"path/filepath"
)

// CollectID devolve o ID do AnyDesk ou "" quando nao instalado/legivel.
func CollectID() string {
	pd := os.Getenv("ProgramData")
	var system []string
	if pd != "" {
		system = []string{
			filepath.Join(pd, "AnyDesk", "system.conf"),
			filepath.Join(pd, "AnyDesk", "service.conf"),
			filepath.Join(pd, "AnyDesk", "ad_svc", "system.conf"),
		}
	}
	var user []string
	for _, pattern := range []string{
		`C:\Users\*\AppData\Roaming\AnyDesk\system.conf`,
		`C:\Users\*\AppData\Roaming\AnyDesk\ad_msi\system.conf`,
	} {
		matches, _ := filepath.Glob(pattern)
		user = append(user, matches...)
	}
	return PickBestID(system, user)
}
