//go:build linux

package anydesk

import "path/filepath"

// CollectID devolve o ID do AnyDesk ou "" quando nao instalado/legivel.
func CollectID() string {
	system := []string{"/etc/anydesk/system.conf", "/etc/anydesk/service.conf"}
	user := []string{"/root/.anydesk/system.conf"}
	matches, _ := filepath.Glob("/home/*/.anydesk/system.conf")
	user = append(user, matches...)
	return PickBestID(system, user)
}
