//go:build !windows

package commands

import "inventario-agent/internal/transport/httpapi"

func executeRestartService(name string) httpapi.CommandResult {
	return httpapi.CommandResult{Status: "failed", ErrorMessage: "restart_service nao suportado nesta plataforma"}
}

func executeRunScript(scriptID string) httpapi.CommandResult {
	return httpapi.CommandResult{Status: "failed", ErrorMessage: "run_script nao suportado nesta plataforma"}
}

func executeRestartComputer() httpapi.CommandResult {
	return httpapi.CommandResult{Status: "failed", ErrorMessage: "restart_computer nao suportado nesta plataforma"}
}
