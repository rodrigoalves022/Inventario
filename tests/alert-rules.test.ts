import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reconcileAlertEvents, evaluateAlertMetric, ALERT_METRICS, parseSoftwareBlacklistMetadata } from '@/lib/alert-rules'

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

type FakeRule = {
  id: string
  clientId: string
  metric: string
  severity: string
  enabled: boolean
  pattern?: string | null
}
type FakeEvent = {
  id: string
  clientId: string
  deviceId: string
  ruleId: string | null
  metric: string
  severity: string
  message: string
  metadataJson?: string | null
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
  const rule: FakeRule = { severity: 'warning', enabled: true, pattern: null, ...overrides }
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

describe('reconcileAlertEvents — catalogo fechado das 5 metricas (antivirus/firewall/UAC/BitLocker/software_blacklisted)', () => {
  it('ALERT_METRICS e exatamente o catalogo de 5 metricas documentado (Sprint 12 acrescenta software_blacklisted)', () => {
    expect(new Set(ALERT_METRICS)).toEqual(
      new Set(['antivirus_inactive', 'firewall_inactive', 'uac_inactive', 'bitlocker_missing', 'software_blacklisted'])
    )
  })

  it.each(ALERT_METRICS)('metrica "%s" com dado NAO apurado (null/pattern vazio) nao dispara nem resolve nada', async (metric) => {
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

// Sprint 12. RF novo — deteccao de software proibido (blacklist), regra
// software_blacklisted com AlertRule.pattern (texto livre, case-insensitive,
// .includes() contra o nome de cada software coletado no check-in).
describe('evaluateAlertMetric — software_blacklisted (Sprint 12)', () => {
  it('pattern nulo/vazio na regra: "nao apurado" de verdade, devolve null (nao dispara)', () => {
    expect(evaluateAlertMetric('software_blacklisted', null, [], { software: [{ nome: 'uTorrent', versao: null }], pattern: null })).toBeNull()
    expect(evaluateAlertMetric('software_blacklisted', null, [], { software: [], pattern: '' })).toBeNull()
    expect(evaluateAlertMetric('software_blacklisted', null, [], { software: [], pattern: '   ' })).toBeNull()
  })

  it('lista de software vazia (pattern valido): resultado valido "nao encontrado", NUNCA null', () => {
    const result = evaluateAlertMetric('software_blacklisted', null, [], { software: [], pattern: 'uTorrent' })
    expect(result).not.toBeNull()
    expect(result?.firing).toBe(false)
  })

  it('nome do software bate por .includes() case-insensitive, mesmo com sufixo/prefixo', () => {
    const result = evaluateAlertMetric('software_blacklisted', null, [], {
      software: [{ nome: 'uTorrent 3.6.0 (build 46691)', versao: '3.6.0' }],
      pattern: 'utorrent',
    })
    expect(result?.firing).toBe(true)
    expect(result?.message).toContain('uTorrent 3.6.0 (build 46691)')
    // Sprint 13: metadata ganhou softwareEditor (null aqui, pois a fixture
    // nao informou editor) — toEqual exige o objeto completo, entao o campo
    // novo precisa aparecer explicitamente, nao so nos casos que o preenchem.
    expect(result?.metadata).toEqual({
      softwareNome: 'uTorrent 3.6.0 (build 46691)',
      softwareVersao: '3.6.0',
      softwareEditor: null,
    })
  })

  it('Sprint 13: editor do software coletado aparece em metadata.softwareEditor quando presente', () => {
    const result = evaluateAlertMetric('software_blacklisted', null, [], {
      software: [{ nome: 'AnyDesk', versao: '7.1.0', editor: 'AnyDesk Software GmbH' }],
      pattern: 'AnyDesk',
    })
    expect(result?.firing).toBe(true)
    expect(result?.metadata).toEqual({
      softwareNome: 'AnyDesk',
      softwareVersao: '7.1.0',
      softwareEditor: 'AnyDesk Software GmbH',
    })
  })

  it('nenhum software da lista bate no pattern: firing false, sem lancar', () => {
    const result = evaluateAlertMetric('software_blacklisted', null, [], {
      software: [{ nome: 'Google Chrome', versao: '120.0' }],
      pattern: 'AnyDesk',
    })
    expect(result?.firing).toBe(false)
  })
})

describe('reconcileAlertEvents — software_blacklisted, ciclo de vida ok<->problema', () => {
  it('transicao ok->problema abre AlertEvent com metadataJson (softwareNome/softwareVersao)', async () => {
    seedRule({ id: 'rule-sw', clientId: 'client-a', metric: 'software_blacklisted', pattern: 'AnyDesk' })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [],
      software: [{ nome: 'AnyDesk', versao: '7.1.0' }],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ ruleId: 'rule-sw', metric: 'software_blacklisted', resolvedAt: null })
    expect(JSON.parse(events[0].metadataJson!)).toEqual({
      softwareNome: 'AnyDesk',
      softwareVersao: '7.1.0',
      softwareEditor: null,
    })
  })

  it('check-ins repetidos com o MESMO software ainda instalado nao duplicam o AlertEvent', async () => {
    seedRule({ id: 'rule-sw', clientId: 'client-a', metric: 'software_blacklisted', pattern: 'AnyDesk' })
    const params = {
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [],
      software: [{ nome: 'AnyDesk', versao: '7.1.0' }],
    }

    await reconcileAlertEvents(params)
    await reconcileAlertEvents(params)
    await reconcileAlertEvents(params)

    expect(events).toHaveLength(1)
  })

  it('software desinstalado (some da lista) resolve o AlertEvent aberto', async () => {
    seedRule({ id: 'rule-sw', clientId: 'client-a', metric: 'software_blacklisted', pattern: 'AnyDesk' })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [],
      software: [{ nome: 'AnyDesk', versao: '7.1.0' }],
    })
    expect(events[0].resolvedAt).toBeNull()

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [],
      software: [], // desinstalado
    })

    expect(events).toHaveLength(1)
    expect(events[0].resolvedAt).not.toBeNull()
  })

  it('software vindo undefined (omitido) e tratado como lista vazia, nao lanca', async () => {
    seedRule({ id: 'rule-sw', clientId: 'client-a', metric: 'software_blacklisted', pattern: 'AnyDesk' })

    await expect(
      reconcileAlertEvents({ clientId: 'client-a', deviceId: 'device-1', security: null, disks: [] })
    ).resolves.not.toThrow()
    expect(events).toHaveLength(0)
  })

  it('regra software_blacklisted com pattern nulo (malformada) nunca dispara', async () => {
    seedRule({ id: 'rule-sw', clientId: 'client-a', metric: 'software_blacklisted', pattern: null })

    await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [],
      software: [{ nome: 'AnyDesk', versao: '7.1.0' }],
    })

    expect(events).toHaveLength(0)
  })

  it('devolve a lista de eventos RECEM-abertos nesta chamada (usado pelo checkin route pra disparar webhook)', async () => {
    seedRule({ id: 'rule-sw', clientId: 'client-a', metric: 'software_blacklisted', pattern: 'Cheat Engine' })

    const opened = await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [],
      software: [{ nome: 'Cheat Engine 7.5', versao: '7.5' }],
    })

    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatchObject({
      metric: 'software_blacklisted',
      metadata: { softwareNome: 'Cheat Engine 7.5', softwareVersao: '7.5' },
    })

    // Na segunda chamada (condicao persiste), nao ha evento NOVO — a lista
    // devolvida fica vazia mesmo com o AlertEvent continuando aberto.
    const openedAgain = await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: null,
      disks: [],
      software: [{ nome: 'Cheat Engine 7.5', versao: '7.5' }],
    })
    expect(openedAgain).toHaveLength(0)
  })

  it('outras 4 metricas (antivirus/firewall/UAC/BitLocker) nunca aparecem na lista de recem-abertos por software', async () => {
    seedRule({ id: 'rule-av', clientId: 'client-a', metric: 'antivirus_inactive' })

    const opened = await reconcileAlertEvents({
      clientId: 'client-a',
      deviceId: 'device-1',
      security: { antivirusAtivo: false, firewallAtivo: null, uacAtivo: null },
      disks: [],
    })

    expect(opened).toHaveLength(1)
    expect(opened[0].metric).toBe('antivirus_inactive')
  })
})

// Sprint 13, item 5/6. Parse defensivo do metadataJson gravado acima — usado
// pela pagina de alertas e pelo relatorio de softwares nao autorizados.
// Mesmo principio de parseMetadata em lib/audit-log.ts: nunca confia
// cegamente no conteudo armazenado, mesmo sendo gravado pelo proprio sistema.
describe('parseSoftwareBlacklistMetadata — parse defensivo de AlertEvent.metadataJson', () => {
  it('null/undefined/string vazia retornam null, sem lancar', () => {
    expect(parseSoftwareBlacklistMetadata(null)).toBeNull()
    expect(parseSoftwareBlacklistMetadata(undefined)).toBeNull()
    expect(parseSoftwareBlacklistMetadata('')).toBeNull()
  })

  it('JSON malformado retorna null, sem lancar', () => {
    expect(parseSoftwareBlacklistMetadata('{nao e json valido')).toBeNull()
  })

  it('JSON valido mas nao e um objeto (array, numero, string) retorna null', () => {
    expect(parseSoftwareBlacklistMetadata('[1,2,3]')).toBeNull()
    expect(parseSoftwareBlacklistMetadata('42')).toBeNull()
    expect(parseSoftwareBlacklistMetadata('"texto"')).toBeNull()
  })

  it('objeto sem softwareNome (ou com tipo errado) retorna null — campo obrigatorio', () => {
    expect(parseSoftwareBlacklistMetadata('{}')).toBeNull()
    expect(parseSoftwareBlacklistMetadata('{"softwareNome": 123}')).toBeNull()
  })

  it('objeto completo e valido e devolvido com os 3 campos normalizados', () => {
    const result = parseSoftwareBlacklistMetadata(
      JSON.stringify({ softwareNome: 'AnyDesk', softwareVersao: '7.1.0', softwareEditor: 'AnyDesk Software GmbH' })
    )
    expect(result).toEqual({ softwareNome: 'AnyDesk', softwareVersao: '7.1.0', softwareEditor: 'AnyDesk Software GmbH' })
  })

  it('softwareVersao/softwareEditor ausentes ou com tipo errado viram null, sem lancar (dado legado da Sprint 12, sem editor)', () => {
    const result = parseSoftwareBlacklistMetadata(JSON.stringify({ softwareNome: 'uTorrent', softwareVersao: null }))
    expect(result).toEqual({ softwareNome: 'uTorrent', softwareVersao: null, softwareEditor: null })
  })
})
