import prisma from '@/lib/prisma'

/**
 * Catalogo fechado de metricas alertaveis, mesmo principio do catalogo de
 * comandos do agente (lib/agent-commands.ts): sem "regra livre" de texto.
 * Todas vem da postura de seguranca coletada em B1 — ate aqui so apareciam
 * passivamente na aba Seguranca, sem gerar alerta nem historico.
 */
export const ALERT_METRICS = [
  'antivirus_inactive',
  'firewall_inactive',
  'uac_inactive',
  'bitlocker_missing',
  // Sprint 12. Unica metrica do catalogo que usa texto livre (AlertRule.pattern)
  // em vez de avaliar so a postura de seguranca coletada — ver evaluateAlertMetric.
  'software_blacklisted',
] as const

export type AlertMetric = (typeof ALERT_METRICS)[number]

export function isAlertMetric(value: unknown): value is AlertMetric {
  return typeof value === 'string' && (ALERT_METRICS as readonly string[]).includes(value)
}

export const ALERT_METRIC_LABELS: Record<AlertMetric, string> = {
  antivirus_inactive: 'Antivírus inativo',
  firewall_inactive: 'Firewall inativo',
  uac_inactive: 'UAC (controle de conta de usuário) desativado',
  bitlocker_missing: 'Disco sem criptografia (BitLocker)',
  software_blacklisted: 'Software não autorizado detectado',
}

export const ALERT_SEVERITIES = ['warning', 'critical'] as const
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number]

export function isAlertSeverity(value: unknown): value is AlertSeverity {
  return typeof value === 'string' && (ALERT_SEVERITIES as readonly string[]).includes(value)
}

type SecuritySnapshot = {
  antivirusAtivo: boolean | null
  firewallAtivo: boolean | null
  uacAtivo: boolean | null
} | null

type DiskSnapshot = { criptografia: string | null }

export type SoftwareSnapshot = { nome: string; versao: string | null }

/** Contexto extra que so o metric 'software_blacklisted' usa — os outros 4
 * cases ignoram por completo (assinatura generica, catalogo fechado). */
export type SoftwareBlacklistContext = {
  software: SoftwareSnapshot[]
  pattern: string | null
}

/**
 * Avalia uma metrica contra o payload de seguranca do check-in atual.
 * Devolve `null` quando o dado esta "nao apurado" — nunca dispara alerta
 * sobre uma ausencia de dado, mesmo principio de `null` em SecurityInfo.
 *
 * `context` (Sprint 12) so e' lido pelo case 'software_blacklisted': os
 * outros 4 cases continuam so com `security`/`disks`, sem quebra de
 * compatibilidade com quem ja chamava esta funcao com 3 argumentos.
 */
export function evaluateAlertMetric(
  metric: AlertMetric,
  security: SecuritySnapshot,
  disks: DiskSnapshot[],
  context?: SoftwareBlacklistContext
): { firing: boolean; message: string; metadata?: Record<string, unknown> } | null {
  switch (metric) {
    case 'antivirus_inactive':
      if (!security || security.antivirusAtivo === null) return null
      return { firing: security.antivirusAtivo === false, message: 'Antivírus inativo ou desatualizado.' }
    case 'firewall_inactive':
      if (!security || security.firewallAtivo === null) return null
      return { firing: security.firewallAtivo === false, message: 'Firewall inativo.' }
    case 'uac_inactive':
      if (!security || security.uacAtivo === null) return null
      return { firing: security.uacAtivo === false, message: 'UAC desativado.' }
    case 'bitlocker_missing': {
      const known = disks.filter((disk) => disk.criptografia === 'on' || disk.criptografia === 'off')
      if (known.length === 0) return null
      const anyOff = known.some((disk) => disk.criptografia === 'off')
      return { firing: anyOff, message: 'Ao menos um disco sem criptografia BitLocker.' }
    }
    case 'software_blacklisted': {
      // Regra malformada (pattern nulo/vazio): "nao apurado" de verdade, nao
      // dispara — diferente de lista de software vazia (ver abaixo), que E'
      // um resultado valido (maquina sem nada instalado que bate no padrao).
      const pattern = context?.pattern?.trim()
      if (!pattern) return null

      const needle = pattern.toLowerCase()
      const match = (context?.software ?? []).find((item) => item.nome.toLowerCase().includes(needle))

      if (!match) {
        // Lista vazia ou nenhum item bate: resultado valido "nao encontrado",
        // nunca null — null e' reservado para dado NAO apurado, que aqui nao
        // existe (a ausencia do software E' o dado).
        return { firing: false, message: '' }
      }

      return {
        firing: true,
        message: `Software não autorizado detectado: ${match.nome}${match.versao ? ` (versão ${match.versao})` : ''}.`,
        metadata: { softwareNome: match.nome, softwareVersao: match.versao },
      }
    }
  }
}

/** Um AlertEvent recem-aberto NESTA chamada (transicao ok->problema). Devolvido
 * pra quem chama poder disparar webhook — reconcileAlertEvents nao tem
 * clientName/clientSlug pra montar o payload sozinho (Sprint 12). */
export type NewlyOpenedAlertEvent = {
  id: string
  metric: string
  severity: string
  message: string
  metadata: Record<string, unknown> | null
}

/**
 * Reconcilia AlertEvent com o estado atual: abre um evento na transicao
 * ok->problema, resolve na transicao problema->ok. Nunca duplica linha
 * enquanto a condicao persiste entre check-ins (ciclo de 1h) — cada linha do
 * historico representa um incidente, do disparo a resolucao.
 *
 * Devolve a lista de eventos recem-abertos NESTA chamada (Sprint 12) — hoje
 * usado so pelo checkin route pra disparar webhook 'device.warning' na
 * abertura de um alerta 'software_blacklisted', mas generico pra qualquer
 * metrica futura que precise do mesmo gatilho.
 */
export async function reconcileAlertEvents(params: {
  clientId: string
  deviceId: string
  security: SecuritySnapshot
  disks: DiskSnapshot[]
  /** Sprint 12. Lista de software coletado no check-in atual — so usado
   * pelas regras 'software_blacklisted'. Ausente/omitido == lista vazia. */
  software?: SoftwareSnapshot[]
}): Promise<NewlyOpenedAlertEvent[]> {
  const rules = await prisma.alertRule.findMany({
    where: { clientId: params.clientId, enabled: true },
  })
  if (rules.length === 0) return []

  const openEvents = await prisma.alertEvent.findMany({
    where: { deviceId: params.deviceId, resolvedAt: null, ruleId: { in: rules.map((rule) => rule.id) } },
  })
  const openByRuleId = new Map(openEvents.map((event) => [event.ruleId, event]))

  const newlyOpened: NewlyOpenedAlertEvent[] = []

  for (const rule of rules) {
    if (!isAlertMetric(rule.metric)) continue
    const result = evaluateAlertMetric(
      rule.metric,
      params.security,
      params.disks,
      rule.metric === 'software_blacklisted'
        ? { software: params.software ?? [], pattern: rule.pattern }
        : undefined
    )
    if (result === null) continue

    const openEvent = openByRuleId.get(rule.id)

    if (result.firing && !openEvent) {
      const created = await prisma.alertEvent.create({
        data: {
          clientId: params.clientId,
          deviceId: params.deviceId,
          ruleId: rule.id,
          metric: rule.metric,
          severity: rule.severity,
          message: result.message,
          metadataJson: result.metadata ? JSON.stringify(result.metadata) : null,
        },
      })
      newlyOpened.push({
        id: created.id,
        metric: rule.metric,
        severity: rule.severity,
        message: result.message,
        metadata: result.metadata ?? null,
      })
    } else if (!result.firing && openEvent) {
      await prisma.alertEvent.update({
        where: { id: openEvent.id },
        data: { resolvedAt: new Date() },
      })
    }
  }

  return newlyOpened
}
