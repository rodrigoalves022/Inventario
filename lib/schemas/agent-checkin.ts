import { z } from 'zod'

const networkSchema = z.object({
  ip: z.string().max(100).optional().nullable(),
  mac: z.string().max(100).optional().nullable(),
  gateway: z.string().max(100).optional().nullable(),
  dns: z.string().max(255).optional().nullable(),
  dhcp: z.boolean().optional().nullable(),
  isPrimary: z.boolean().optional().nullable(),
})

const diskSchema = z.object({
  unidade: z.string().max(20).optional().nullable(),
  modelo: z.string().max(255).optional().nullable(),
  tipo: z.string().max(50).optional().nullable(),
  capacidadeGb: z.number().int().optional().nullable(),
  espacoLivreGb: z.number().int().optional().nullable(),
  criptografia: z.enum(['on', 'off', 'unknown']).optional().nullable(),
})

/**
 * Booleanos opcionais e nulaveis de proposito: ausente/nulo significa
 * "nao apurado", nunca "desativado". Windows Server nao expoe o namespace
 * SecurityCenter2, entao antivirus e firewall chegam nulos mesmo com protecao.
 */
const securitySchema = z.object({
  antivirusNome: z.string().max(255).optional().nullable(),
  antivirusAtivo: z.boolean().optional().nullable(),
  antivirusAtualizado: z.boolean().optional().nullable(),
  firewallAtivo: z.boolean().optional().nullable(),
  secureBootAtivo: z.boolean().optional().nullable(),
  tpmPresente: z.boolean().optional().nullable(),
  uacAtivo: z.boolean().optional().nullable(),
  observacao: z.string().max(500).optional().nullable(),
})

const localAccountSchema = z.object({
  usuario: z.string().min(1).max(255),
  isAdmin: z.boolean().optional().default(false),
  habilitada: z.boolean().optional().default(true),
  senhaNuncaExpira: z.boolean().optional().default(false),
})

const softwareSchema = z.object({
  nome: z.string().min(1).max(255),
  versao: z.string().max(255).optional().nullable(),
  editor: z.string().max(255).optional().nullable(),
  installadoEm: z.string().max(100).optional().nullable(),
})

const eventLogSchema = z
  .object({
    source: z.string().max(255).optional().nullable(),
    level: z.string().max(32).optional().nullable(),
    eventId: z.number().int().optional().nullable(),
    message: z.string().max(5000).optional().nullable(),
    timeCreated: z.string().max(100).optional().nullable(),
  })
  .passthrough()

export const agentCheckinSchema = z.object({
  hostname: z.string().min(1, 'hostname é obrigatório').max(255),
  agentVersion: z.string().max(50).optional().nullable(),
  serial: z.string().max(255).optional().nullable(),
  fabricante: z.string().max(255).optional().nullable(),
  modelo: z.string().max(255).optional().nullable(),
  dominio: z.string().max(255).optional().nullable(),
  usuario: z.string().max(255).optional().nullable(),

  sistema: z.string().max(255).optional().nullable(),
  versaoSO: z.string().max(255).optional().nullable(),
  processador: z.string().max(255).optional().nullable(),
  ramTotalGb: z.number().int().optional().nullable(),
  slot1: z.string().max(255).optional().nullable(),
  slot2: z.string().max(255).optional().nullable(),
  slot3: z.string().max(255).optional().nullable(),
  slot4: z.string().max(255).optional().nullable(),
  placaMae: z.string().max(255).optional().nullable(),
  tipoArmazenamento: z.string().max(255).optional().nullable(),

  redes: z.array(networkSchema).max(20).optional().default([]),
  discos: z.array(diskSchema).max(20).optional().default([]),
  // 300 era baixo demais: uma estacao Windows comum passa de 300 entradas, e
  // estourar o limite rejeitava o check-in INTEIRO (400), nao so a lista.
  software: z.array(softwareSchema).max(2000).optional().default([]),

  seguranca: securitySchema.optional().nullable(),
  contasLocais: z.array(localAccountSchema).max(200).optional().default([]),

  eventLogs: z.array(eventLogSchema).max(500).optional().default([]),
})

export type AgentCheckinPayload = z.infer<typeof agentCheckinSchema>

