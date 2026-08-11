//go:build windows

package commands

import (
	"fmt"
	"os/exec"
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
	default:
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "script desconhecido: " + scriptID}
	}
}

func runCommand(name string, args ...string) httpapi.CommandResult {
	cmd := exec.Command(name, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: err.Error(), Output: string(output)}
	}
	return httpapi.CommandResult{Status: "done", Output: string(output)}
}
