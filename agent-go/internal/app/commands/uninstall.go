package commands

import (
	"log"
	"os"
	"os/exec"
	"runtime"
	"time"

	"inventario-agent/internal/transport/httpapi"
)

const windowsUninstallScript = `Start-Sleep -Seconds 2; ` +
	`Stop-Service -Name 'InventarioAgent' -Force -ErrorAction SilentlyContinue; ` +
	`sc.exe delete InventarioAgent; ` +
	`Remove-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\InventarioAgent' -Recurse -Force -ErrorAction SilentlyContinue; ` +
	`Remove-Item -Path 'C:\ProgramData\InventarioAgent' -Recurse -Force -ErrorAction SilentlyContinue; ` +
	`Remove-Item -Path 'C:\Program Files\InventarioAgent' -Recurse -Force -ErrorAction SilentlyContinue`

// Ordem deliberada: `systemctl disable --now` mata o cgroup do servico (e este
// proprio sh, mesmo com setsid), entao o stop fica por ultimo, depois de tudo
// ja removido. Remover o binario em execucao e seguro no Linux.
const linuxUninstallScript = `sleep 2; ` +
	`systemctl disable inventario-agent 2>/dev/null || true; ` +
	`rm -f /etc/systemd/system/inventario-agent.service; ` +
	`rm -rf /opt/inventario-agent /var/lib/inventario-agent; ` +
	`rm -f /usr/local/bin/inventario-agent; ` +
	`systemctl daemon-reload 2>/dev/null || true; ` +
	`systemctl stop inventario-agent 2>/dev/null || true`

// executeUninstallAgent devolve "done" de imediato e agenda a auto-remocao com
// atraso de 4s: da tempo de PollAndExecute reportar o resultado ao servidor
// (que revoga o AgentAuth ao receber "done") antes do processo ser encerrado.
func executeUninstallAgent() httpapi.CommandResult {
	switch runtime.GOOS {
	case "windows", "linux":
	default:
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "uninstall_agent nao suportado nesta plataforma: " + runtime.GOOS}
	}

	go func() {
		time.Sleep(4 * time.Second)

		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-NoProfile", "-WindowStyle", "Hidden", "-Command", windowsUninstallScript)
		} else {
			cmd = exec.Command("/bin/sh", "-c", linuxUninstallScript)
		}
		detachProcess(cmd)

		if err := cmd.Start(); err != nil {
			log.Printf("[COMMANDS] Falha ao iniciar auto-remocao do agente: %v", err)
			return
		}
		_ = cmd.Process.Release()
		os.Exit(0)
	}()

	return httpapi.CommandResult{
		Status: "done",
		Output: "desinstalacao remota iniciada (servico, credenciais e binario serao removidos em ~4s)",
	}
}
