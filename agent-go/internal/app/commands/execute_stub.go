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
