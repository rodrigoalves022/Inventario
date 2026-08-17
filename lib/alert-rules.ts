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

/**
 * Avalia uma metrica contra o payload de seguranca do check-in atual.
 * Devolve `null` quando o dado esta "nao apurado" — nunca dispara alerta
 * sobre uma ausencia de dado, mesmo principio de `null` em SecurityInfo.
 */
export function evaluateAlertMetric(
  metric: AlertMetric,
  security: SecuritySnapshot,
  disks: DiskSnapshot[]
): { firing: boolean; message: string } | null {
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
  }
}

/**
 * Reconcilia AlertEvent com o estado atual: abre um evento na transicao
 * ok->problema, resolve na transicao problema->ok. Nunca duplica linha
 * enquanto a condicao persiste entre check-ins (ciclo de 1h) — cada linha do
 * historico representa um incidente, do disparo a resolucao.
 */
export async function reconcileAlertEvents(params: {
  clientId: string
  deviceId: string
  security: SecuritySnapshot
  disks: DiskSnapshot[]
}) {
  const rules = await prisma.alertRule.findMany({
    where: { clientId: params.clientId, enabled: true },
  })
  if (rules.length === 0) return

  const openEvents = await prisma.alertEvent.findMany({
    where: { deviceId: params.deviceId, resolvedAt: null, ruleId: { in: rules.map((rule) => rule.id) } },
  })
  const openByRuleId = new Map(openEvents.map((event) => [event.ruleId, event]))

  for (const rule of rules) {
    if (!isAlertMetric(rule.metric)) continue
    const result = evaluateAlertMetric(rule.metric, params.security, params.disks)
    if (result === null) continue

    const openEvent = openByRuleId.get(rule.id)

    if (result.firing && !openEvent) {
      await prisma.alertEvent.create({
        data: {
          clientId: params.clientId,
          deviceId: params.deviceId,
          ruleId: rule.id,
          metric: rule.metric,
          severity: rule.severity,
          message: result.message,
        },
      })
    } else if (!result.firing && openEvent) {
      await prisma.alertEvent.update({
        where: { id: openEvent.id },
        data: { resolvedAt: new Date() },
      })
    }
  }
}
