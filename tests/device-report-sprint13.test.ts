import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDeviceReportSummary,
  computeRowBitlockerStatus,
  getBlacklistedSoftwareHistory,
  getDeviceReportRows,
  type DeviceReportRow,
} from '@/lib/reports/device-report'

// Sprint 13. Relatorio executivo em PDF ganhou 4 blocos novos de conteudo
// (tipo de dispositivo, conformidade de seguranca — BitLocker/antivirus
// atualizado/firewall —, discos criticos e softwares nao autorizados). Este
// arquivo cobre as peças novas de lib/reports/device-report.ts que
// tests/device-report.test.ts (RN010) e tests/device-report-rn013.test.ts
// (bucket-nao-soma) nao cobrem: a agregacao de BitLocker por maquina, a
// classificacao computador/servidor, o percentual de conformidade sobre o
// denominador "apurado" (nao o total da frota), a lista de discos criticos
// achatada com hostname, e o historico de software nao autorizado por tenant.

type FakeDisk = { unidade: string | null; capacidadeGb: number | null; espacoLivreGb: number | null; criptografia: string | null }
type FakeDevice = {
  id: string
  clientId: string
  hostname: string
  status: string
  updatedAt: Date
  hardware: { sistema: string | null; processador: string | null; ramTotalGb: number | null } | null
  disks: FakeDisk[]
  networks: Array<{ ip: string | null }>
  security: { antivirusAtivo: boolean | null; firewallAtivo: boolean | null; antivirusAtualizado: boolean | null } | null
  assetRecord: { etiqueta: string | null; localizacao: string | null; responsavel: string | null } | null
  logs: Array<{ coletadoEm: Date }>
}
type FakeAlertEvent = {
  clientId: string
  metric: string
  metadataJson: string | null
  firedAt: Date
  resolvedAt: Date | null
  device: { hostname: string }
}

const { deviceList, alertEventList, fakePrisma } = vi.hoisted(() => {
  const deviceList: FakeDevice[] = []
  const alertEventList: FakeAlertEvent[] = []

  const fakePrisma = {
    device: {
      findMany: vi.fn(async ({ where }: { where?: { clientId?: string } }) => {
        if (where?.clientId) return deviceList.filter((device) => device.clientId === where.clientId)
        return deviceList
      }),
    },
    alertEvent: {
      findMany: vi.fn(
        async ({
          where,
          take,
        }: {
          where: { clientId: string; metric: string }
          take?: number
        }) => {
          const filtered = alertEventList
            .filter((event) => event.clientId === where.clientId && event.metric === where.metric)
            .sort((a, b) => b.firedAt.getTime() - a.firedAt.getTime())
          return typeof take === 'number' ? filtered.slice(0, take) : filtered
        }
      ),
    },
  }

  return { deviceList, alertEventList, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedDevice(overrides: Partial<FakeDevice> & { id: string; hostname: string }) {
  const device: FakeDevice = {
    clientId: 'client-a',
    status: 'online',
    updatedAt: new Date(),
    hardware: null,
    disks: [],
    networks: [],
    security: null,
    assetRecord: null,
    logs: [],
    ...overrides,
  }
  deviceList.push(device)
  return device
}

function makeRow(overrides: Partial<DeviceReportRow>): DeviceReportRow {
  return {
    hostname: 'HOST-01',
    status: 'online',
    ip: null,
    sistema: null,
    processador: null,
    ramTotalGb: null,
    discoCapacidadeGb: null,
    discoLivreGb: null,
    antivirusAtivo: null,
    firewallAtivo: null,
    ultimaColeta: null,
    etiquetaPatrimonio: null,
    localizacao: null,
    responsavel: null,
    deviceType: 'computador',
    antivirusAtualizado: null,
    bitlockerAtivo: null,
    criticalDisks: [],
    ...overrides,
  }
}

beforeEach(() => {
  deviceList.length = 0
  alertEventList.length = 0
  vi.clearAllMocks()
})

describe('computeRowBitlockerStatus — agregacao por maquina, pior caso (Sprint 13)', () => {
  it('sem discos: null (nao apurado)', () => {
    expect(computeRowBitlockerStatus([])).toBeNull()
  })

  it('todos os discos com criptografia desconhecida (null/"unknown"): null', () => {
    expect(computeRowBitlockerStatus([{ criptografia: null }, { criptografia: 'unknown' }])).toBeNull()
  })

  it('todos os discos conhecidos estao "on": true', () => {
    expect(computeRowBitlockerStatus([{ criptografia: 'on' }, { criptografia: 'on' }])).toBe(true)
  })

  it('ao menos um disco conhecido "off": false, mesmo com outros "on" (pior caso, nao maioria)', () => {
    expect(computeRowBitlockerStatus([{ criptografia: 'on' }, { criptografia: 'off' }])).toBe(false)
  })

  it('disco desconhecido misturado com discos "on" nao contamina o resultado: ainda true', () => {
    expect(computeRowBitlockerStatus([{ criptografia: 'on' }, { criptografia: null }])).toBe(true)
  })
})

describe('getDeviceReportRows — campos novos por device (Sprint 13)', () => {
  it('deviceType classifica via isServerOperatingSystem (mesmo helper que /computers vs /servers)', async () => {
    seedDevice({ id: 'd1', hostname: 'SRV-01', hardware: { sistema: 'Windows Server 2019 Standard', processador: null, ramTotalGb: null } })
    seedDevice({ id: 'd2', hostname: 'PC-01', hardware: { sistema: 'Windows 11 Pro', processador: null, ramTotalGb: null } })
    seedDevice({ id: 'd3', hostname: 'SEM-HARDWARE' })

    const rows = await getDeviceReportRows({ clientId: 'client-a' })

    expect(rows.find((r) => r.hostname === 'SRV-01')?.deviceType).toBe('servidor')
    expect(rows.find((r) => r.hostname === 'PC-01')?.deviceType).toBe('computador')
    // Sem sistema coletado: nunca "servidor" por omissao — isServerOperatingSystem(null) e false.
    expect(rows.find((r) => r.hostname === 'SEM-HARDWARE')?.deviceType).toBe('computador')
  })

  it('bitlockerAtivo por device reflete computeRowBitlockerStatus sobre Disk.criptografia', async () => {
    seedDevice({
      id: 'd1',
      hostname: 'ALL-ON',
      disks: [
        { unidade: 'C:', capacidadeGb: 256, espacoLivreGb: 100, criptografia: 'on' },
        { unidade: 'D:', capacidadeGb: 512, espacoLivreGb: 200, criptografia: 'on' },
      ],
    })
    seedDevice({
      id: 'd2',
      hostname: 'ONE-OFF',
      disks: [
        { unidade: 'C:', capacidadeGb: 256, espacoLivreGb: 100, criptografia: 'on' },
        { unidade: 'D:', capacidadeGb: 512, espacoLivreGb: 200, criptografia: 'off' },
      ],
    })

    const rows = await getDeviceReportRows({ clientId: 'client-a' })

    expect(rows.find((r) => r.hostname === 'ALL-ON')?.bitlockerAtivo).toBe(true)
    expect(rows.find((r) => r.hostname === 'ONE-OFF')?.bitlockerAtivo).toBe(false)
  })

  it('antivirusAtualizado espelha SecurityPosture.antivirusAtualizado, null quando sem SecurityPosture', async () => {
    seedDevice({ id: 'd1', hostname: 'HOST-AV', security: { antivirusAtivo: true, firewallAtivo: true, antivirusAtualizado: false } })
    seedDevice({ id: 'd2', hostname: 'HOST-NO-SEC', security: null })

    const rows = await getDeviceReportRows({ clientId: 'client-a' })

    expect(rows.find((r) => r.hostname === 'HOST-AV')?.antivirusAtualizado).toBe(false)
    expect(rows.find((r) => r.hostname === 'HOST-NO-SEC')?.antivirusAtualizado).toBeNull()
  })

  it('criticalDisks usa o alertDiskThresholdGb recebido (parametro do tenant), nao um valor fixo', async () => {
    seedDevice({
      id: 'd1',
      hostname: 'HOST-A',
      disks: [
        { unidade: 'C:', capacidadeGb: 256, espacoLivreGb: 5, criptografia: null },
        { unidade: 'D:', capacidadeGb: 512, espacoLivreGb: 200, criptografia: null },
      ],
    })

    const rowsDefaultThreshold = await getDeviceReportRows({ clientId: 'client-a' }) // default 10 GB
    expect(rowsDefaultThreshold[0].criticalDisks).toEqual([{ unidade: 'C:', capacidadeGb: 256, espacoLivreGb: 5 }])

    const rowsHigherThreshold = await getDeviceReportRows({ clientId: 'client-a' }, 24, 250) // tenant com limiar de 250 GB
    expect(rowsHigherThreshold[0].criticalDisks).toHaveLength(2) // os 2 discos ficam abaixo de 250 GB livres
  })
})

describe('buildDeviceReportSummary — securityCompliance (Sprint 13): percentual sobre maquinas APURADAS, nao sobre o total', () => {
  it('bitlockerActivePercent ignora do denominador as maquinas sem dado (bitlockerAtivo null)', () => {
    const rows = [
      makeRow({ hostname: 'A', bitlockerAtivo: true }),
      makeRow({ hostname: 'B', bitlockerAtivo: true }),
      makeRow({ hostname: 'C', bitlockerAtivo: false }),
      makeRow({ hostname: 'D', bitlockerAtivo: null }), // nao apurado — fora do denominador
    ]
    const summary = buildDeviceReportSummary(rows)

    // 2 de 3 apurados = 66.7%, NAO 2 de 4 (que daria 50.0% e esconderia que 1
    // maquina simplesmente nao tem dado — misturar "nao apurado" com
    // "desativado" e o erro que este teste trava).
    expect(summary.securityCompliance.bitlockerActivePercent).toBe('66.7')
    expect(summary.securityCompliance.bitlockerKnownCount).toBe(3)
  })

  it('antivirusUpdatedPercent e firewallActivePercent sao calculados de forma independente entre si', () => {
    const rows = [
      makeRow({ hostname: 'A', antivirusAtualizado: true, firewallAtivo: false }),
      makeRow({ hostname: 'B', antivirusAtualizado: false, firewallAtivo: true }),
      makeRow({ hostname: 'C', antivirusAtualizado: null, firewallAtivo: true }),
    ]
    const summary = buildDeviceReportSummary(rows)

    expect(summary.securityCompliance.antivirusUpdatedPercent).toBe('50.0') // 1 de 2 apurados
    expect(summary.securityCompliance.antivirusUpdatedKnownCount).toBe(2)
    expect(summary.securityCompliance.firewallActivePercent).toBe('66.7') // 2 de 3, nenhum null aqui
    expect(summary.securityCompliance.firewallKnownCount).toBe(3)
  })

  it('frota inteira sem dado apurado: percentual "0.0" (sem NaN nem divisao por zero), knownCount 0', () => {
    const rows = [makeRow({ hostname: 'A' }), makeRow({ hostname: 'B' })]
    const summary = buildDeviceReportSummary(rows)

    expect(summary.securityCompliance.bitlockerActivePercent).toBe('0.0')
    expect(summary.securityCompliance.bitlockerKnownCount).toBe(0)
    expect(summary.securityCompliance.antivirusUpdatedPercent).toBe('0.0')
    expect(summary.securityCompliance.firewallActivePercent).toBe('0.0')
  })
})

describe('buildDeviceReportSummary — computadores/servidores (Sprint 13)', () => {
  it('conta por deviceType; a soma dos dois bate exatamente com totalDevices', () => {
    const rows = [
      makeRow({ hostname: 'PC-1', deviceType: 'computador' }),
      makeRow({ hostname: 'PC-2', deviceType: 'computador' }),
      makeRow({ hostname: 'SRV-1', deviceType: 'servidor' }),
    ]
    const summary = buildDeviceReportSummary(rows)

    expect(summary.computadores).toBe(2)
    expect(summary.servidores).toBe(1)
    expect(summary.computadores + summary.servidores).toBe(summary.totalDevices)
  })
})

describe('buildDeviceReportSummary — criticalDisks achatados com hostname (Sprint 13)', () => {
  it('achata DeviceReportRow.criticalDisks de todas as maquinas, anexando o hostname de cada uma', () => {
    const rows = [
      makeRow({ hostname: 'HOST-A', criticalDisks: [{ unidade: 'C:', capacidadeGb: 256, espacoLivreGb: 5 }] }),
      makeRow({ hostname: 'HOST-B', criticalDisks: [] }),
      makeRow({
        hostname: 'HOST-C',
        criticalDisks: [
          { unidade: 'C:', capacidadeGb: 128, espacoLivreGb: 3 },
          { unidade: 'D:', capacidadeGb: 512, espacoLivreGb: 8 },
        ],
      }),
    ]
    const summary = buildDeviceReportSummary(rows)

    expect(summary.criticalDisks).toEqual([
      { hostname: 'HOST-A', unidade: 'C:', capacidadeGb: 256, espacoLivreGb: 5 },
      { hostname: 'HOST-C', unidade: 'C:', capacidadeGb: 128, espacoLivreGb: 3 },
      { hostname: 'HOST-C', unidade: 'D:', capacidadeGb: 512, espacoLivreGb: 8 },
    ])
  })
})

describe('getBlacklistedSoftwareHistory — historico por tenant, fail-closed (Sprint 13)', () => {
  it('escopado por clientId + metric software_blacklisted; um evento de OUTRO tenant nunca aparece', async () => {
    alertEventList.push(
      {
        clientId: 'client-a',
        metric: 'software_blacklisted',
        metadataJson: JSON.stringify({ softwareNome: 'AnyDesk', softwareVersao: '7.1.0', softwareEditor: 'AnyDesk Software GmbH' }),
        firedAt: new Date('2026-01-02T00:00:00Z'),
        resolvedAt: null,
        device: { hostname: 'PC-A' },
      },
      {
        clientId: 'client-b',
        metric: 'software_blacklisted',
        metadataJson: JSON.stringify({ softwareNome: 'DE-OUTRO-TENANT' }),
        firedAt: new Date('2026-01-03T00:00:00Z'),
        resolvedAt: null,
        device: { hostname: 'PC-B' },
      },
      {
        clientId: 'client-a',
        metric: 'antivirus_inactive', // outra metrica: nunca deve entrar no historico de software
        metadataJson: null,
        firedAt: new Date('2026-01-04T00:00:00Z'),
        resolvedAt: null,
        device: { hostname: 'PC-A' },
      }
    )

    const history = await getBlacklistedSoftwareHistory('client-a')

    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      hostname: 'PC-A',
      softwareNome: 'AnyDesk',
      softwareVersao: '7.1.0',
      softwareEditor: 'AnyDesk Software GmbH',
    })
  })

  it('metadataJson ausente ou malformado e descartado silenciosamente, sem lancar (parse defensivo)', async () => {
    alertEventList.push(
      { clientId: 'client-a', metric: 'software_blacklisted', metadataJson: null, firedAt: new Date(), resolvedAt: null, device: { hostname: 'PC-X' } },
      { clientId: 'client-a', metric: 'software_blacklisted', metadataJson: '{invalido', firedAt: new Date(), resolvedAt: null, device: { hostname: 'PC-Y' } }
    )

    await expect(getBlacklistedSoftwareHistory('client-a')).resolves.toEqual([])
  })

  it('mais recentes primeiro (firedAt desc), respeitando o limit', async () => {
    alertEventList.push(
      { clientId: 'client-a', metric: 'software_blacklisted', metadataJson: JSON.stringify({ softwareNome: 'Antigo' }), firedAt: new Date('2026-01-01T00:00:00Z'), resolvedAt: null, device: { hostname: 'PC-1' } },
      { clientId: 'client-a', metric: 'software_blacklisted', metadataJson: JSON.stringify({ softwareNome: 'Recente' }), firedAt: new Date('2026-01-05T00:00:00Z'), resolvedAt: null, device: { hostname: 'PC-2' } }
    )

    const history = await getBlacklistedSoftwareHistory('client-a', 1)

    expect(history).toHaveLength(1)
    expect(history[0].softwareNome).toBe('Recente')
  })
})
