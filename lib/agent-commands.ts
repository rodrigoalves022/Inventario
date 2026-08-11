import { z } from 'zod'

/**
 * v1: catálogo restrito de tipos/params, deliberadamente sem "run arbitrary text".
 * O agente Go só sabe executar exatamente estes tipos/ids — o servidor nunca manda
 * texto de script livre pela rede. Expandir aqui e no agente juntos, nunca só de um lado.
 */
export const RESTARTABLE_SERVICES = ['Spooler', 'wuauserv', 'BITS'] as const
export const SCRIPT_CATALOG_IDS = ['flush_dns', 'clear_temp_files', 'restart_explorer'] as const

export const AGENT_COMMAND_TTL_MS = 15 * 60 * 1000 // comando não reclamado expira em 15min

export const agentCommandInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('collect_now') }),
  z.object({
    type: z.literal('restart_service'),
    serviceName: z.enum(RESTARTABLE_SERVICES),
  }),
  z.object({
    type: z.literal('run_script'),
    scriptId: z.enum(SCRIPT_CATALOG_IDS),
  }),
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
      return null
    case 'restart_service':
      return JSON.stringify({ serviceName: input.serviceName })
    case 'run_script':
      return JSON.stringify({ scriptId: input.scriptId })
  }
}
