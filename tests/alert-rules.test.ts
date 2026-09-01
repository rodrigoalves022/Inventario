import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reconcileAlertEvents, evaluateAlertMetric, ALERT_METRICS } from '@/lib/alert-rules'

// Sprint 10, item 8. RF015/RF016 — catalogo de 4 metricas de seguranca
// (antivirus/firewall/UAC/BitLocker), reconcileAlertEvents (lib/alert-rules.ts).
// NAO sobrepoe a Sprint 9 (tests/availability-alerts.test.ts,
// tests/checkin-availability-reconciliation.test.ts): aquele arquivo cobre o
// caminho SINTETICO (ruleId: null, device_offline/low_disk, disparado por
// reconcileAvailabilityEvents). Este arquivo cobre o fluxo mais antigo,
// baseado em AlertRule configurada pelo cliente (ruleId preenchido), que ate
// esta sprint nao tinha nenhum teste automatizado — confirmado lendo
// app/api/agent/checkin/route.ts:215 (chamada real) e grep em
// tests/checkin-availability-reconciliation.test.ts (nenhuma referencia a
// reconcileAlertEvents).

type FakeRule = { id: string; clientId: string; metric: string; severity: string; enabled: boolean }
type FakeEvent = {
  id: string
  clientId: string
  deviceId: string
  ruleId: string | null
  metric: string
  severity: string
  message: string
  firedAt: Date
  resolvedAt: Date | null
}

const { rules, events, fakePrisma } = vi.hoisted(() => {
  const rules = new Map<string, FakeRule>()
  const events: FakeEvent[] = []
  let counter = 0

  const fakePrisma = {
    alertRule: {
      findMany: vi.fn(async ({ where }: { where: { clientId: string; enabled: boolean } }) =>
        [...rules.values()].filter((rule) => rule.clientId === where.clientId && rule.enabled === where.enabled)
      ),
    },
    alertEvent: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { deviceId: string; resolvedAt: null; ruleId: { in: string[] } }
        }) =>
          events.filter(
            (event) =>
              event.deviceId === where.deviceId &&
              event.resolvedAt === null &&
              event.ruleId !== null &&
              where.ruleId.in.includes(event.ruleId)
          )
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeEvent, 'id' | 'firedAt' | 'resolvedAt'> }) => {
        const event: FakeEvent = { id: `evt-${++counter}`, firedAt: new Date(), resolvedAt: null, ...data }
        events.push(event)
        return event
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { resolvedAt: Date } }) => {
        const event = events.find((candidate) => candidate.id === where.id)
        if (event) Object.assign(event, data)
        return event
      }),
    },
  }

  return { rules, events, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedRule(overrides: Partial<FakeRule> & { id: string; clientId: string; metric: string }) {
  const rule: FakeRule = { severity: 'warning', enabled: true, ...overrides }
  rules.set(rule.id, rule)
  return rule
}

beforeEach(() => {
  rules.clear()
  events.length = 0
  vi.clearAllMocks()
})

describe('reconcileAlertEvents — ciclo de vida ok<->problema (RF015)', () => {
  it('transicao ok->problema abre um AlertEvent vinculado a regra', async () => {
    seedRule({ id: 'rule-av', clientId: 'client-a', metric: 'antivirus_inactive' })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: { antivirusAtivo: false, firewallAtivo: null, uacAtivo: null },
      disks: [],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      clientId: 'client-a',
      deviceId: 'device-1',
      ruleId: 'rule-av',
      metric: 'antivirus_inactive',
      resolvedAt: null,
    })
  })

  it('transicao problema->ok resolve o evento aberto (resolvedAt preenchido)', async () => {
    seedRule({ id: 'rule-av', clientId: 'client-a', metric: 'antivirus_inactive' })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: { antivirusAtivo: false, firewallAtivo: null, uacAtivo: null },
      disks: [],
    })
    expect(events[0].resolvedAt).toBeNull()

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: { antivirusAtivo: true, firewallAtivo: null, uacAtivo: null },
      disks: [],
    })

    expect(events).toHaveLength(1)
    expect(events[0].resolvedAt).not.toBeNull()
  })

  it('condicao persistente entre dois check-ins NAO duplica linha', async () => {
    seedRule({ id: 'rule-av', clientId: 'client-a', metric: 'antivirus_inactive' })
    const params = {
      clientId: 'client-a',
      deviceId: 'device-1',
      security: { antivirusAtivo: false, firewallAtivo: null, uacAtivo: null },
      disks: [],
    }

    await reconcileAlertEvents(params)
    await reconcileAlertEvents(params)
    await reconcileAlertEvents(params)

    expect(events).toHaveLength(1)
  })

  it('regra desabilitada (enabled: false) nunca dispara nem resolve', async () => {
    seedRule({ id: 'rule-av', clientId: 'client-a', metric: 'antivirus_inactive', enabled: false })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: { antivirusAtivo: false, firewallAtivo: null, uacAtivo: null },
      disks: [],
    })

    expect(events).toHaveLength(0)
  })
})

describe('reconcileAlertEvents — catalogo fechado das 4 metricas (antivirus/firewall/UAC/BitLocker)', () => {
  it('ALERT_METRICS e exatamente o catalogo de 4 metricas documentado', () => {
    expect(new Set(ALERT_METRICS)).toEqual(
      new Set(['antivirus_inactive', 'firewall_inactive', 'uac_inactive', 'bitlocker_missing'])
    )
  })

  it.each(ALERT_METRICS)('metrica "%s" com dado NAO apurado (null) nao dispara nem resolve nada', async (metric) => {
    seedRule({ id: `rule-${metric}`, clientId: 'client-a', metric })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [],
    })

    expect(events).toHaveLength(0)
  })

  it('firewall_inactive e uac_inactive avaliam independentemente de antivirus_inactive', async () => {
    seedRule({ id: 'rule-fw', clientId: 'client-a', metric: 'firewall_inactive' })
    seedRule({ id: 'rule-uac', clientId: 'client-a', metric: 'uac_inactive' })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: { antivirusAtivo: true, firewallAtivo: false, uacAtivo: false },
      disks: [],
    })

    const metrics = events.map((event) => event.metric).sort()
    expect(metrics).toEqual(['firewall_inactive', 'uac_inactive'])
  })

  it('bitlocker_missing dispara quando ALGUM disco esta com criptografia "off"', async () => {
    seedRule({ id: 'rule-bl', clientId: 'client-a', metric: 'bitlocker_missing' })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [{ criptografia: 'on' }, { criptografia: 'off' }],
    })

    expect(events).toHaveLength(1)
    expect(events[0].metric).toBe('bitlocker_missing')
  })

  it('bitlocker_missing com discos "nao apurado" (null/undefined) nao dispara', async () => {
    seedRule({ id: 'rule-bl', clientId: 'client-a', metric: 'bitlocker_missing' })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [{ criptografia: null }],
    })

    expect(events).toHaveLength(0)
  })

  it('evaluateAlertMetric devolve null (nao apurado) para cada uma das 4 metricas quando o dado de entrada e nulo', () => {
    expect(evaluateAlertMetric('antivirus_inactive', null, [])).toBeNull()
    expect(evaluateAlertMetric('firewall_inactive', null, [])).toBeNull()
    expect(evaluateAlertMetric('uac_inactive', null, [])).toBeNull()
    expect(evaluateAlertMetric('bitlocker_missing', { antivirusAtivo: null, firewallAtivo: null, uacAtivo: null }, [])).toBeNull()
  })
})

describe('reconcileAlertEvents — sem regra habilitada, nao consulta AlertEvent', () => {
  it('clientId sem nenhuma AlertRule habilitada nao chama alertEvent.findMany', async () => {
    await reconcileAlertEvents({
      clientId: 'client-sem-regras',
      deviceId: 'device-1',
      security: { antivirusAtivo: false, firewallAtivo: false, uacAtivo: false },
      disks: [{ criptografia: 'off' }],
    })

    expect(fakePrisma.alertEvent.findMany).not.toHaveBeenCalled()
    expect(events).toHaveLength(0)
  })
})
