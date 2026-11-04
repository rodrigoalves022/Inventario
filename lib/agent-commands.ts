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

/**
 * O que cada script faz, para o operador decidir antes de enfileirar.
 * `command` resume o que o agente roda (agent-go/internal/app/commands/
 * execute_windows.go) — e' texto de exibicao, nunca vai para a rede.
 */
export const SCRIPT_CATALOG_DETAILS: Record<(typeof SCRIPT_CATALOG_IDS)[number], { description: string; command: string }> = {
  flush_dns: {
    description: 'Descarta o cache de resolução de nomes da máquina. Use quando um site ou servidor mudou de IP.',
    command: 'ipconfig /flushdns',
  },
  clear_temp_files: {
    description: 'Apaga os arquivos temporários do serviço do agente (LocalSystem), não os do usuário logado.',
    command: 'del /Q /F /S "%TEMP%\\*"',
  },
  restart_explorer: {
    description: 'Encerra e reabre o Explorer: a barra de tarefas e as pastas abertas do usuário logado somem por alguns segundos.',
    command: 'taskkill /IM explorer.exe /F; explorer.exe',
  },
  flush_print_spooler: {
    description: 'Para o spooler, apaga os trabalhos presos na fila de impressão e inicia o serviço de novo.',
    command: 'Spooler: parar, limpar spool\\PRINTERS, iniciar',
  },
  gpupdate_force: {
    description: 'Reaplica as políticas de grupo do computador e do usuário sem esperar o ciclo do domínio.',
    command: 'gpupdate /force',
  },
  network_diag: {
    description: 'Devolve adaptadores e IPs, a tabela de rotas IPv4 e as portas TCP em escuta, com o PID de cada uma.',
    command: 'ipconfig /all; route print -4; netstat -ano | findstr LISTENING',
  },
  system_health_summary: {
    description: 'Lista os 15 processos que mais ocupam memória, com o tempo de CPU de cada um.',
    command: 'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15',
  },
  defender_quick_scan: {
    description: 'Atualiza as assinaturas do Microsoft Defender, roda a varredura rápida e devolve o estado da proteção em tempo real.',
    command: 'Update-MpSignature; Start-MpScan -ScanType QuickScan',
  },
  windows_update_check: {
    description: 'Consulta o Windows Update e devolve quantas KBs estão pendentes, com título e severidade das 15 primeiras. Não instala nada.',
    command: "Microsoft.Update.Session: Search('IsInstalled=0')",
  },
}
