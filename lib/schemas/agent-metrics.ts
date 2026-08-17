import { z } from 'zod'

/**
 * Numeros opcionais e nulaveis de proposito: ausente/nulo significa "nao
 * apurado nesta amostra", nunca 0 — 0% de CPU pareceria maquina ociosa em
 * vez de dado ausente, o mesmo principio usado em SecurityInfo.
 */
export const agentMetricsSchema = z.object({
  hostname: z.string().min(1, 'hostname é obrigatório').max(255),
  agentVersion: z.string().max(50).optional().nullable(),
  cpuPercent: z.number().min(0).max(100).optional().nullable(),
  ramUsadaGb: z.number().min(0).max(100_000).optional().nullable(),
  ramTotalGb: z.number().min(0).max(100_000).optional().nullable(),
  discoUsadoGb: z.number().min(0).max(1_000_000).optional().nullable(),
  discoLivreGb: z.number().min(0).max(1_000_000).optional().nullable(),
  uptimeSegundos: z.number().int().min(0).optional().nullable(),
})

export type AgentMetricsPayload = z.infer<typeof agentMetricsSchema>
