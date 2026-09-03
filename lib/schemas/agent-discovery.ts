import { z } from 'zod'

/**
 * Sprint 14 — payload da varredura de descoberta de rede
 * (`POST /api/agent/discovery`, `agent-go/internal/collectors/discovery`).
 *
 * Mesmo principio de `lib/schemas/agent-checkin.ts`: TODO array e TODA string
 * tem `.max()` explicito. Payload de agente e' entrada NAO confiavel — e aqui
 * mais ainda que no check-in, porque o conteudo (sysDescr, hostname, MAC)
 * vem de dispositivos de TERCEIROS na rede, que o agente so repassa; nao ha
 * nenhuma etapa em que a maquina do agente valide semanticamente aquilo.
 */

/**
 * Catalogo FECHADO, espelhado no classificador do agente
 * (`agent-go/internal/collectors/discovery/classify.go`) — mesma defesa em
 * profundidade do catalogo de comandos remotos (RNF003): a allowlist existe
 * dos DOIS lados, deliberadamente duplicada, nao compartilhada por um unico
 * ponto de compilacao.
 *
 * Decisao registrada: enum ESTRITO, nao `.catch('UNKNOWN')`. Um agente de
 * versao futura que invente um tipo novo tem o payload REJEITADO com 400 (e
 * o erro fica visivel), em vez de ter o tipo silenciosamente reescrito para
 * UNKNOWN e gravado como se fosse dado bom. Falha visivel > corrupcao
 * silenciosa; o custo e' acoplar versao de agente e de servidor, que este
 * projeto ja aceita para o catalogo de comandos.
 */
export const DISCOVERED_DEVICE_TYPES = [
  'PRINTER',
  'SWITCH',
  'ROUTER',
  'NAS',
  'ACCESS_POINT',
  'UNKNOWN',
] as const

export type DiscoveredDeviceType = (typeof DISCOVERED_DEVICE_TYPES)[number]

/**
 * Somente IPv4 em notacao decimal pontuada: a varredura do agente calcula uma
 * /24 IPv4 a partir da interface primaria e nunca produz outra coisa. Aceitar
 * texto livre aqui abriria a porta para gravar qualquer string como "IP" numa
 * coluna que participa da chave unica `(clientId, ip)` e e' exibida na UI.
 * A validacao de faixa (0-255 por octeto) e' feita no superRefine abaixo — o
 * regex sozinho aceitaria "999.999.999.999".
 */
const IPV4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

const ipv4Schema = z
  .string()
  .trim()
  .min(7)
  .max(15)
  .regex(IPV4_PATTERN, 'IP deve ser IPv4 em notacao decimal pontuada.')
  .superRefine((value, context) => {
    const octets = value.split('.')
    for (const octet of octets) {
      const parsed = Number(octet)
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Octeto de IPv4 fora da faixa 0-255.',
        })
        return
      }
    }
  })

const discoveredDeviceSchema = z.object({
  ip: ipv4Schema,
  // MAC chega da tabela ARP do SO; `null` quando ausente, NUNCA inventado.
  mac: z.string().trim().max(64).optional().nullable(),
  hostname: z.string().trim().max(255).optional().nullable(),
  vendor: z.string().trim().max(255).optional().nullable(),
  deviceType: z.enum(DISCOVERED_DEVICE_TYPES).optional().default('UNKNOWN'),
  // sysDescr de switch/roteador costuma ser longo (banner completo de
  // firmware); 1024 acomoda os reais sem virar campo de texto livre irrestrito.
  snmpSysDescr: z.string().trim().max(1024).optional().nullable(),
  // "80,161,9100" — no maximo 8 portas de 5 digitos + separadores.
  openPorts: z.string().trim().max(64).optional().nullable(),
})

export const agentDiscoverySchema = z.object({
  // Hostname da MAQUINA QUE VARREU (nao do dispositivo descoberto), mesmo
  // campo de identificacao presente em checkin/metrics.
  hostname: z.string().min(1, 'hostname é obrigatório').max(255),
  agentVersion: z.string().max(50).optional().nullable(),
  // Subnet varrida, ex "192.168.1.0/24". Informativo (log/diagnostico), nao
  // e' persistido — a linha de DiscoveredDevice ja carrega o IP.
  subnet: z.string().trim().max(64).optional().nullable(),
  // Uma /24 rende no maximo ~254 hosts. 512 da folga para o caso de o agente
  // varrer duas interfaces no futuro, sem virar array irrestrito.
  devices: z.array(discoveredDeviceSchema).max(512).optional().default([]),
})

export type AgentDiscoveryPayload = z.infer<typeof agentDiscoverySchema>
export type AgentDiscoveredDevice = z.infer<typeof discoveredDeviceSchema>
