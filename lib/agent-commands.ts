import { z } from 'zod'

/**
 * v1: catálogo restrito de tipos/params, deliberadamente sem "run arbitrary text".
 * O agente Go só sabe executar exatamente estes tipos/ids — o servidor nunca manda
 * texto de script livre pela rede. Expandir aqui e no agente juntos, nunca só de um lado.
 */
export const RESTARTABLE_SERVICES = ['Spooler', 'wuauserv', 'BITS', 'Dnscache'] as const
export const SCRIPT_CATALOG_IDS = ['flush_dns', 'clear_temp_files', 'restart_explorer', 'flush_print_spooler', 'gpupdate_force', 'network_diag', 'system_health_summary', 'defender_quick_scan', 'windows_update_check'] as const

export const AGENT_COMMAND_TTL_MS = 15 * 60 * 1000 // comando não reclamado expira em 15min

export const agentCommandInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('collect_now') }),
  z.object({ type: z.literal('collect_metrics_now') }),
  z.object({ type: z.literal('update_agent') }),
  z.object({
    type: z.literal('restart_service'),
    serviceName: z.enum(RESTARTABLE_SERVICES),
  }),
  z.object({
    type: z.literal('run_script'),
    scriptId: z.enum(SCRIPT_CATALOG_IDS),
  }),
  z.object({ type: z.literal('restart_computer') }),
  z.object({ type: z.literal('uninstall_agent') }),
])

export type AgentCommandInput = z.infer<typeof agentCommandInputSchema>

export const agentCommandResultSchema = z.object({
  status: z.enum(['done', 'failed']),
  output: z.string().max(20_000).optional(),
  errorMessage: z.string().max(2_000).optional(),
})

export function toParamsJson(input: AgentCommandInput): string | null {
  switch (input.type) {
    case 'collect_now':
    case 'collect_metrics_now':
    case 'update_agent':
    case 'restart_computer':
    case 'uninstall_agent':
      return null
    case 'restart_service':
      return JSON.stringify({ serviceName: input.serviceName })
    case 'run_script':
      return JSON.stringify({ scriptId: input.scriptId })
  }
}

export const COMMAND_TYPE_LABELS: Record<string, string> = {
  collect_now: 'Forçar coleta completa',
  collect_metrics_now: 'Coletar métricas agora',
  update_agent: 'Atualizar agente agora',
  restart_service: 'Reiniciar serviço',
  run_script: 'Rodar script',
  restart_computer: 'Reiniciar máquina',
  uninstall_agent: 'Desinstalar agente remotamente',
}

export const RESTARTABLE_SERVICE_LABELS: Record<(typeof RESTARTABLE_SERVICES)[number], string> = {
  Spooler: 'Fila de impressão',
  wuauserv: 'Windows Update',
  BITS: 'Serviço de Transferência Inteligente (BITS)',
  Dnscache: 'Cliente DNS',
}

export const SCRIPT_CATALOG_LABELS: Record<(typeof SCRIPT_CATALOG_IDS)[number], string> = {
  flush_dns: 'Limpar cache DNS',
  clear_temp_files: 'Limpar arquivos temporários',
  restart_explorer: 'Reiniciar Explorer',
  flush_print_spooler: 'Limpar fila de impressão',
  gpupdate_force: 'Atualizar políticas de grupo (gpupdate /force)',
  network_diag: 'Diagnóstico de rede (IP, rotas e portas)',
  system_health_summary: 'Top processos por consumo de RAM/CPU',
  defender_quick_scan: 'Atualizar assinaturas e varredura rápida (Defender)',
  windows_update_check: 'Verificar atualizações pendentes do sistema',
}
