//go:build !windows

package commands

import (
	"os/exec"

	"inventario-agent/internal/transport/httpapi"
)

func executeRestartService(name string) httpapi.CommandResult {
	return httpapi.CommandResult{Status: "failed", ErrorMessage: "restart_service nao suportado nesta plataforma"}
}

// Apenas os diagnosticos somente-leitura rodam fora do Windows.
func executeRunScript(scriptID string) httpapi.CommandResult {
	switch scriptID {
	case "network_diag":
		return runShell("ip addr 2>/dev/null || ifconfig; ip route 2>/dev/null || netstat -rn")
	case "system_health_summary":
		return runShell("uptime; free -m 2>/dev/null; ps aux --sort=-%mem 2>/dev/null | head -n 16")
	case "defender_quick_scan":
		return runShell("if command -v clamscan >/dev/null 2>&1; then clamscan --version; else echo 'Microsoft Defender / ClamAV nao instalado neste host Linux.'; fi")
	case "windows_update_check":
		return runShell("if command -v apt >/dev/null 2>&1; then apt list --upgradable 2>/dev/null | head -n 25; elif command -v dnf >/dev/null 2>&1; then dnf check-update -q | head -n 25; else echo 'Gerenciador de pacotes nao suportado.'; fi")
	default:
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "run_script nao suportado nesta plataforma: " + scriptID}
	}
}

func runShell(script string) httpapi.CommandResult {
	output, err := exec.Command("sh", "-c", script).CombinedOutput()
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: err.Error(), Output: string(output)}
	}
	return httpapi.CommandResult{Status: "done", Output: string(output)}
}

func executeRestartComputer() httpapi.CommandResult {
	return httpapi.CommandResult{Status: "failed", ErrorMessage: "restart_computer nao suportado nesta plataforma"}
}
