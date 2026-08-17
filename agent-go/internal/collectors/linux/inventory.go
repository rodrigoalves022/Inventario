//go:build linux

package linuxcollector

import (
	"bufio"
	"net"
	"os"
	"strconv"
	"strings"

	"inventario-agent/internal/domain/inventory"
)

func collectNetworks() []inventory.NetworkInfo {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	var result []inventory.NetworkInfo
	primarySet := false

	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		var ip string
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok || ipNet.IP.To4() == nil {
				continue
			}
			ip = ipNet.IP.String()
			break
		}
		if ip == "" {
			continue
		}

		info := inventory.NetworkInfo{
			IP:  ip,
			MAC: iface.HardwareAddr.String(),
			// DHCP nao detectado nesta primeira versao: exigiria ler estado de
			// dhclient/systemd-networkd, especifico por distro. false e' o
			// padrao neutro (nao afirma DHCP sem confirmar).
			DHCP:      false,
			IsPrimary: !primarySet,
		}
		primarySet = true
		result = append(result, info)
	}

	return result
}

// filesystemTypes: apenas sistemas de arquivo "reais", excluindo virtuais
// (proc, sysfs, tmpfs, overlay de container, cgroup...) que poluiriam a
// lista com entradas sem significado de capacidade.
var realFilesystemTypes = map[string]bool{
	"ext2": true, "ext3": true, "ext4": true,
	"xfs": true, "btrfs": true, "zfs": true,
	"ntfs": true, "vfat": true, "exfat": true, "fuseblk": true,
}

func collectDisks() []inventory.DiskInfo {
	file, err := os.Open("/proc/mounts")
	if err != nil {
		return nil
	}
	defer file.Close()

	seen := make(map[string]bool)
	var result []inventory.DiskInfo

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 3 {
			continue
		}
		device, mountPoint, fsType := fields[0], fields[1], fields[2]

		if !realFilesystemTypes[fsType] || seen[device] {
			continue
		}

		usedGb, freeGb, ok := statfsGb(mountPoint)
		if !ok {
			continue
		}
		capacidadeGb := usedGb + freeGb
		if capacidadeGb < 1 {
			continue
		}
		seen[device] = true

		result = append(result, inventory.DiskInfo{
			Unidade:      mountPoint,
			Tipo:         fsType,
			CapacidadeGb: int(capacidadeGb),
			// EspacoLivreGb usa Bavail (espaco disponivel para usuario comum),
			// mesma metrica usada em statfsGb.
			EspacoLivreGb: int(freeGb),
		})
	}

	return result
}

const maxSoftwareEntries = 2000

// collectDpkgSoftware le /var/lib/dpkg/status direto (formato de estrofes
// RFC822), sem invocar `dpkg -l` como subprocesso. So cobre Debian/Ubuntu —
// distros RPM (RHEL/Fedora) ficam sem lista de software nesta primeira
// versao; lista vazia, nao erro, ja que a maquina pode legitimamente nao
// usar dpkg.
func collectDpkgSoftware() []inventory.SoftwareInfo {
	file, err := os.Open("/var/lib/dpkg/status")
	if err != nil {
		return nil
	}
	defer file.Close()

	var result []inventory.SoftwareInfo
	var name, version, status string

	flush := func() {
		if name != "" && strings.Contains(status, "installed") {
			result = append(result, inventory.SoftwareInfo{
				Nome:   name,
				Versao: version,
			})
		}
		name, version, status = "", "", ""
	}

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		if len(result) >= maxSoftwareEntries {
			break
		}
		line := scanner.Text()
		if line == "" {
			flush()
			continue
		}
		key, value, found := strings.Cut(line, ": ")
		if !found {
			continue
		}
		switch key {
		case "Package":
			name = value
		case "Version":
			version = value
		case "Status":
			status = value
		}
	}
	flush()

	return result
}

// adminGroups: nomes de grupo que concedem privilegio administrativo,
// variando por familia de distro (Debian/Ubuntu usa "sudo", RHEL/openSUSE
// tradicionalmente usa "wheel").
var adminGroups = map[string]bool{"sudo": true, "wheel": true, "admin": true}

func readGroupMembers(groupName string) map[string]bool {
	members := make(map[string]bool)
	file, err := os.Open("/etc/group")
	if err != nil {
		return members
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), ":")
		if len(fields) < 4 || fields[0] != groupName {
			continue
		}
		for _, member := range strings.Split(fields[3], ",") {
			member = strings.TrimSpace(member)
			if member != "" {
				members[member] = true
			}
		}
	}
	return members
}

type shadowInfo struct {
	locked           bool
	senhaNuncaExpira bool
}

// readShadow exige privilegio de root — se o agente rodar sem root (comum
// fora de um systemd unit dedicado), o mapa vem vazio e os campos
// dependentes ficam no padrao conservador, nunca inventado.
func readShadow() map[string]shadowInfo {
	result := make(map[string]shadowInfo)
	file, err := os.Open("/etc/shadow")
	if err != nil {
		return result
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), ":")
		if len(fields) < 5 {
			continue
		}
		user := fields[0]
		passwordField := fields[1]
		maxDays := fields[4]

		locked := strings.HasPrefix(passwordField, "!") || passwordField == "*"
		neverExpires := maxDays == "" || maxDays == "-1" || maxDays == "99999"

		result[user] = shadowInfo{locked: locked, senhaNuncaExpira: neverExpires}
	}
	return result
}

const minRealUid = 1000
const maxRealUid = 60000

// collectLocalAccounts le /etc/passwd filtrando pela faixa convencional de
// UID de usuario "real" (exclui contas de sistema/servico, tipicamente < 1000,
// e "nobody" em 65534). Mesmo espirito do filtro LocalAccount=True do
// coletor Windows: sem isso, contas de servico do proprio SO poluiriam a
// lista.
func collectLocalAccounts() ([]inventory.LocalAccountInfo, string) {
	file, err := os.Open("/etc/passwd")
	if err != nil {
		return nil, "contas locais nao apuradas: /etc/passwd inacessivel"
	}
	defer file.Close()

	adminUsers := make(map[string]bool)
	for group := range adminGroups {
		for user := range readGroupMembers(group) {
			adminUsers[user] = true
		}
	}
	shadow := readShadow()
	shadowAvailable := len(shadow) > 0

	var result []inventory.LocalAccountInfo
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), ":")
		if len(fields) < 7 {
			continue
		}
		username := fields[0]
		uid, err := strconv.Atoi(fields[2])
		if err != nil || uid < minRealUid || uid > maxRealUid {
			continue
		}
		// /bin/false ou /usr/sbin/nologin: conta de servico sem login
		// interativo, mesmo com UID na faixa "real" (comum em containers).
		shell := fields[6]
		if strings.HasSuffix(shell, "nologin") || strings.HasSuffix(shell, "/false") {
			continue
		}

		info := inventory.LocalAccountInfo{
			Usuario:          username,
			IsAdmin:          adminUsers[username],
			Habilitada:       true,
			SenhaNuncaExpira: false,
		}
		if entry, ok := shadow[username]; ok {
			info.Habilitada = !entry.locked
			info.SenhaNuncaExpira = entry.senhaNuncaExpira
		}
		result = append(result, info)
	}

	note := ""
	if !shadowAvailable {
		note = "situacao de senha (habilitada/nunca expira) nao apurada: /etc/shadow exige privilegio de root"
	}
	return result, note
}
