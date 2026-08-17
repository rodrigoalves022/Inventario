package commands

import (
	"encoding/json"
	"log"

	"inventario-agent/internal/app/checkin"
	"inventario-agent/internal/config"
	"inventario-agent/internal/transport/httpapi"
)

type restartServiceParams struct {
	ServiceName string `json:"serviceName"`
}

type runScriptParams struct {
	ScriptID string `json:"scriptId"`
}

// PollAndExecute consulta se ha um comando pendente e executa no maximo um por chamada.
// Chamado de um ticker curto e separado do ticker de coleta completa (1h).
func PollAndExecute(client *httpapi.Client, cfg *config.Config) {
	cmd, err := client.PollCommand()
	if err != nil {
		log.Printf("[COMMANDS] Falha ao consultar comandos pendentes: %v", err)
		return
	}
	if cmd == nil {
		return
	}

	log.Printf("[COMMANDS] Comando recebido: id=%s type=%s", cmd.ID, cmd.Type)
	result := execute(cfg, cmd)

	if err := client.ReportCommandResult(cmd.ID, result); err != nil {
		log.Printf("[COMMANDS] Falha ao reportar resultado do comando %s: %v", cmd.ID, err)
	}
}

func execute(cfg *config.Config, cmd *httpapi.PendingCommand) httpapi.CommandResult {
	switch cmd.Type {
	case "collect_now":
		return executeCollectNow(cfg)
	case "collect_metrics_now":
		return executeCollectMetricsNow(cfg)
	case "restart_computer":
		return executeRestartComputer()
	case "restart_service":
		var params restartServiceParams
		if err := json.Unmarshal(cmd.Params, &params); err != nil {
			return httpapi.CommandResult{Status: "failed", ErrorMessage: "params invalidos: " + err.Error()}
		}
		if !isAllowedService(params.ServiceName) {
			return httpapi.CommandResult{Status: "failed", ErrorMessage: "servico nao permitido: " + params.ServiceName}
		}
		return executeRestartService(params.ServiceName)
	case "run_script":
		var params runScriptParams
		if err := json.Unmarshal(cmd.Params, &params); err != nil {
			return httpapi.CommandResult{Status: "failed", ErrorMessage: "params invalidos: " + err.Error()}
		}
		if !isAllowedScript(params.ScriptID) {
			return httpapi.CommandResult{Status: "failed", ErrorMessage: "script nao catalogado: " + params.ScriptID}
		}
		return executeRunScript(params.ScriptID)
	default:
		return httpapi.CommandResult{Status: "failed", ErrorMessage: "tipo de comando desconhecido: " + cmd.Type}
	}
}

func executeCollectNow(cfg *config.Config) httpapi.CommandResult {
	payload, err := checkin.SendOnce(cfg)
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: err.Error()}
	}
	return httpapi.CommandResult{Status: "done", Output: "checkin enviado: " + payload.Hostname}
}

func executeCollectMetricsNow(cfg *config.Config) httpapi.CommandResult {
	payload, err := checkin.SendMetricsOnce(cfg)
	if err != nil {
		return httpapi.CommandResult{Status: "failed", ErrorMessage: err.Error()}
	}
	return httpapi.CommandResult{Status: "done", Output: "metricas enviadas: " + payload.Hostname}
}

// allowlist espelha lib/agent-commands.ts (RESTARTABLE_SERVICES / SCRIPT_CATALOG_IDS) -
// o servidor ja valida antes de enfileirar, isto e defesa em profundidade no agente.
var allowedServices = map[string]bool{"Spooler": true, "wuauserv": true, "BITS": true, "Dnscache": true}
var allowedScripts = map[string]bool{
	"flush_dns":           true,
	"clear_temp_files":    true,
	"restart_explorer":    true,
	"flush_print_spooler": true,
}

func isAllowedService(name string) bool { return allowedServices[name] }
func isAllowedScript(id string) bool    { return allowedScripts[id] }
