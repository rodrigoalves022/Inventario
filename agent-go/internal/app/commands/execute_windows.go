//go:build windows

package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"

	"inventario-agent/internal/transport/httpapi"
)

func executeRestartService(name string) httpapi.CommandResult {
	manager, err := mgr.Connect()
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "SCM: " + err.Error()}
	}
	defer manager.Disconnect()

	service, err := manager.OpenService(name)
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "servico nao encontrado: " + err.Error()}
	}
	defer service.Close()

	status, err := service.Query()
	if err == nil && status.State == svc.Running {
		if _, err := service.Control(svc.Stop); err != nil {
			return httpapi.CommandResult{Status: "failed", ErrorMessage: "falha ao parar servico: " + err.Error()}
		}
		time.Sleep(2 * time.Second)
	}

	if err := service.Start(); err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "falha ao iniciar servico: " + err.Error()}
	}

	return httpapi.CommandResult{Status: "done", Output: fmt.Sprintf("servico %s reiniciado com sucesso", name)}
}

// scripts do catalogo: comandos fixos, nunca texto vindo da rede.
func executeRunScript(scriptID string) httpapi.CommandResult {
	switch scriptID {
	case "flush_dns":
		return runCommand("ipconfig", "/flushdns")
	case "clear_temp_files":
		// Roda como LocalSystem: limpa o %TEMP% do proprio servico, nao o do usuario logado.
		return runCommand("cmd", "/C", `del /Q /F /S "%TEMP%\*" 2>nul & exit 0`)
	case "restart_explorer":
		_ = exec.Command("taskkill", "/IM", "explorer.exe", "/F").Run()
		return runCommand("explorer.exe")
	case "flush_print_spooler":
		return executeFlushPrintSpooler()
	case "gpupdate_force":
		return runCommand("gpupdate", "/force")
	case "network_diag":
		return runCommand("cmd", "/C", "ipconfig /all & route print -4 & netstat -ano | findstr LISTENING")
	case "system_health_summary":
		return runCommand("powershell", "-NoProfile", "-Command", "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 Name,Id,@{N='RAM_MB';E={[math]::Round($_.WorkingSet64/1MB,1)}},CPU | Format-Table -AutoSize | Out-String -Width 120")
	default:
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "script desconhecido: " + scriptID}
	}
}

// executeFlushPrintSpooler para o servico antes de apagar a fila: o Spooler
// mantem os arquivos .SPL/.SHD abertos, entao apagar com o servico rodando
// falha silenciosamente para a maioria dos itens.
func executeFlushPrintSpooler() httpapi.CommandResult {
	manager, err := mgr.Connect()
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "SCM: " + err.Error()}
	}
	defer manager.Disconnect()

	service, err := manager.OpenService("Spooler")
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "servico Spooler nao encontrado: " + err.Error()}
	}
	defer service.Close()

	if status, err := service.Query(); err == nil && status.State == svc.Running {
		if _, err := service.Control(svc.Stop); err != nil {
			return httpapi.CommandResult{Status: "failed", ErrorMessage: "falha ao parar Spooler: " + err.Error()}
		}
		time.Sleep(2 * time.Second)
	}

	spoolDir := filepath.Join(os.Getenv("WINDIR"), "System32", "spool", "PRINTERS")
	entries, _ := os.ReadDir(spoolDir)
	removed := 0
	for _, entry := range entries {
		if err := os.Remove(filepath.Join(spoolDir, entry.Name())); err == nil {
			removed++
		}
	}

	if err := service.Start(); err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "falha ao reiniciar Spooler apos limpar a fila: " + err.Error()}
	}

	return httpapi.CommandResult{Status: "done", Output: fmt.Sprintf("fila de impressao limpa (%d arquivo(s) removido(s))", removed)}
}

// executeRestartComputer agenda o reinicio com atraso curto: da tempo do
// resultado "done" chegar ao servidor antes da maquina cair.
func executeRestartComputer() httpapi.CommandResult {
	return runCommand("shutdown", "/r", "/t", "10", "/c", "Reinicio solicitado remotamente via Inventario Enterprise")
}

func runCommand(name string, args ...string) httpapi.CommandResult {
	cmd := exec.Command(name, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: err.Error(), Output: string(output)}
	}
	return httpapi.CommandResult{Status: "done", Output: string(output)}
}
