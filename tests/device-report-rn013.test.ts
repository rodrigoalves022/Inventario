import { describe, expect, it } from 'vitest'
import { buildDeviceReportSummary, type DeviceReportRow } from '@/lib/reports/device-report'

/**
 * RN013 ("bucket, nunca soma"): ao agregar hardware/disco de um parque
 * heterogeneo, o sistema sempre conta QUANTAS maquinas caem em cada
 * faixa/valor exato — nunca soma valores absolutos entre maquinas
 * diferentes num unico numero. Ja foi violada e corrigida mais de uma vez
 * no historico real do projeto (commits 4da5f97, f1bcbc1, 5e7b7f6) — este
 * arquivo existe para travar regressao futura especificamente desse padrao.
 *
 * Arquivo companheiro de `tests/device-report.test.ts` (que cobre RN010 —
 * status efetivo/offline). Separado em arquivo proprio, em vez de um novo
 * `describe` no arquivo existente, porque RN013 e uma regra distinta com
 * seu proprio "parque heterogeneo" de fixtures — misturar os dois teria
 * dificultado achar rapidamente "o teste que prova RN013" (a pergunta
 * padrao do test-auditor) num arquivo que hoje ja e 100% sobre RN010.
 */

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
    // Sprint 13
    deviceType: 'computador',
    antivirusAtualizado: null,
    bitlockerAtivo: null,
    criticalDisks: [],
    ...overrides,
  }
}

// Parque heterogeneo de verdade: capacidades bem diferentes entre si, nao
// multiplos redondos da mesma faixa (evita que um bug de soma "acerte por
// coincidencia" um numero que tambem seria uma contagem plausivel).
const HETEROGENEOUS_FLEET: DeviceReportRow[] = [
  makeRow({ hostname: 'NOTE-11GB', ramTotalGb: 11, discoCapacidadeGb: 128, discoLivreGb: 96 }), // disco: 25% usado
  makeRow({ hostname: 'DESK-18GB-A', ramTotalGb: 18, discoCapacidadeGb: 512, discoLivreGb: 435 }), // 15% usado
  makeRow({ hostname: 'DESK-18GB-B', ramTotalGb: 18, discoCapacidadeGb: 2048, discoLivreGb: 122 }), // ~94% usado
  makeRow({ hostname: 'SERVER-64GB', ramTotalGb: 64, discoCapacidadeGb: 4096, discoLivreGb: 61 }), // ~99% usado (critico)
  makeRow({ hostname: 'WORKSTATION-33GB', ramTotalGb: 33, discoCapacidadeGb: 256, discoLivreGb: 199 }), // ~22% usado
]

describe('RN013 — ramDistribution conta maquinas por valor exato de RAM, nunca soma GB', () => {
  it('produz sempre uma lista de { label, count } onde count e numero de maquinas', () => {
    const summary = buildDeviceReportSummary(HETEROGENEOUS_FLEET)

    for (const bucket of summary.ramDistribution) {
      expect(bucket).toHaveProperty('label')
      expect(bucket).toHaveProperty('count')
      expect(typeof bucket.count).toBe('number')
      // Nenhum bucket individual pode ter mais maquinas do que o parque
      // inteiro — pega de forma grosseira um count que na verdade e uma
      // soma de GB (ex.: "18" de dois notes de 18GB somados vira 36).
      expect(bucket.count).toBeLessThanOrEqual(HETEROGENEOUS_FLEET.length)
      expect(bucket.count).toBeGreaterThan(0)
    }
  })

  it('agrupa corretamente por valor exato: dois dispositivos com o mesmo RAM viram um bucket de count=2', () => {
    const summary = buildDeviceReportSummary(HETEROGENEOUS_FLEET)

    const bucket18gb = summary.ramDistribution.find((b) => b.label === '18 GB')
    expect(bucket18gb).toBeDefined()
    expect(bucket18gb?.count).toBe(2) // DESK-18GB-A e DESK-18GB-B

    const bucket11gb = summary.ramDistribution.find((b) => b.label === '11 GB')
    expect(bucket11gb?.count).toBe(1)

    const bucket64gb = summary.ramDistribution.find((b) => b.label === '64 GB')
    expect(bucket64gb?.count).toBe(1)
  })

  it('a soma de todos os count em ramDistribution bate exatamente com N (nenhuma maquina duplicada nem perdida)', () => {
    const summary = buildDeviceReportSummary(HETEROGENEOUS_FLEET)
    const totalCounted = summary.ramDistribution.reduce((sum, bucket) => sum + bucket.count, 0)
    expect(totalCounted).toBe(HETEROGENEOUS_FLEET.length)
  })

  it('dispositivos sem ramTotalGb (null) sao excluidos da distribuicao, nao contados como 0 GB', () => {
    const fleetWithMissingRam = [
      ...HETEROGENEOUS_FLEET,
      makeRow({ hostname: 'SEM-HARDWARE-COLETADO', ramTotalGb: null }),
    ]
    const summary = buildDeviceReportSummary(fleetWithMissingRam)
    const totalCounted = summary.ramDistribution.reduce((sum, bucket) => sum + bucket.count, 0)
    // Total de maquinas com dado valido continua 5, nao 6 — a maquina sem
    // coleta de hardware nao vira um bucket "0 GB" nem e ignorada em silencio
    // de um jeito que quebraria a paridade com o total de dispositivos.
    expect(totalCounted).toBe(HETEROGENEOUS_FLEET.length)
    expect(summary.ramDistribution.find((b) => b.label === '0 GB')).toBeUndefined()
  })

  it('regressao: count nunca e a SOMA de ramTotalGb das maquinas do bucket, mesmo quando isso coincidiria com um numero plausivel', () => {
    // Fixture desenhada para que "soma dos valores" e "contagem de maquinas"
    // produzam numeros bem diferentes e faceis de distinguir: 3 maquinas de
    // 8GB cada. count correto = 3 (contagem). Uma regressao para soma
    // produziria 24 (8+8+8) no lugar de 3.
    const threeMachinesWithSameRam: DeviceReportRow[] = [
      makeRow({ hostname: 'A', ramTotalGb: 8 }),
      makeRow({ hostname: 'B', ramTotalGb: 8 }),
      makeRow({ hostname: 'C', ramTotalGb: 8 }),
    ]
    const summary = buildDeviceReportSummary(threeMachinesWithSameRam)
    const bucket8gb = summary.ramDistribution.find((b) => b.label === '8 GB')

    expect(bucket8gb?.count).toBe(3) // contagem de maquinas, correto
    expect(bucket8gb?.count).not.toBe(24) // soma de GB (8+8+8), a regressao que este teste trava
  })
})

describe('RN013 — diskUsageDistribution classifica cada maquina pela propria % de uso, nunca por um blend entre discos de tamanhos diferentes', () => {
  it('um disco pequeno quase cheio e um disco grande quase vazio caem em faixas opostas, cada um pela propria %', () => {
    const smallAlmostFull = makeRow({ hostname: 'SMALL-FULL', discoCapacidadeGb: 64, discoLivreGb: 2 }) // ~97% usado
    const bigAlmostEmpty = makeRow({ hostname: 'BIG-EMPTY', discoCapacidadeGb: 8192, discoLivreGb: 8000 }) // ~2% usado

    const summary = buildDeviceReportSummary([smallAlmostFull, bigAlmostEmpty])

    const criticalBucket = summary.diskUsageDistribution.find((b) => b.label === '95%+ usado (crítico)')
    const lowBucket = summary.diskUsageDistribution.find((b) => b.label === 'Até 50% usado')

    expect(criticalBucket?.count).toBe(1) // SMALL-FULL
    expect(lowBucket?.count).toBe(1) // BIG-EMPTY

    // Uma % "blendada" entre os dois discos (2 GB + 8000 GB livres sobre 64
    // + 8192 GB totais = ~97% livre no total) classificaria as DUAS
    // maquinas como pouco usadas — o oposto do que SMALL-FULL realmente e.
    // Confirma que cada maquina foi avaliada isoladamente.
    expect(criticalBucket?.count).not.toBe(0)
  })

  it('a soma de todos os count em diskUsageDistribution bate com o numero de dispositivos com dado valido de disco', () => {
    const summary = buildDeviceReportSummary(HETEROGENEOUS_FLEET)
    const totalCounted = summary.diskUsageDistribution.reduce((sum, bucket) => sum + bucket.count, 0)
    expect(totalCounted).toBe(HETEROGENEOUS_FLEET.length)
  })

  it('dispositivos sem disco reportado (capacidade ou livre null/zero) sao excluidos, nunca contados numa faixa arbitraria', () => {
    const fleetWithMissingDisk = [
      ...HETEROGENEOUS_FLEET,
      makeRow({ hostname: 'SEM-DISCO-COLETADO', discoCapacidadeGb: null, discoLivreGb: null }),
      makeRow({ hostname: 'DISCO-CAPACIDADE-ZERO', discoCapacidadeGb: 0, discoLivreGb: 0 }),
    ]
    const summary = buildDeviceReportSummary(fleetWithMissingDisk)
    const totalCounted = summary.diskUsageDistribution.reduce((sum, bucket) => sum + bucket.count, 0)
    expect(totalCounted).toBe(HETEROGENEOUS_FLEET.length)
  })
})

describe('RN013 — exceção documentada: storageCapacityGb/storageFreeGb/storageUsedGb SÃO soma bruta da frota, de propósito', () => {
  it('storageCapacityGb e storageFreeGb somam os valores absolutos de todas as maquinas (nao sao bucket)', () => {
    const summary = buildDeviceReportSummary(HETEROGENEOUS_FLEET)

    const expectedCapacity = HETEROGENEOUS_FLEET.reduce((sum, row) => sum + (row.discoCapacidadeGb ?? 0), 0)
    const expectedFree = HETEROGENEOUS_FLEET.reduce((sum, row) => sum + (row.discoLivreGb ?? 0), 0)

    expect(summary.storageCapacityGb).toBe(expectedCapacity)
    expect(summary.storageFreeGb).toBe(expectedFree)
    expect(summary.storageUsedGb).toBe(expectedCapacity - expectedFree)
  })

  it('storageCapacityGb NAO e uma contagem de maquinas — continua sendo a soma bruta mesmo com parque heterogeneo grande', () => {
    // Este teste e o espelho do de ramDistribution acima: aqui, ao contrario
    // de ramDistribution/diskUsageDistribution, a soma bruta E o
    // comportamento correto e documentado (RF020/RN013) — nao deveria ser
    // "corrigido" para bucket por engano. Confirma que o valor bate com a
    // soma (nao com N, que seria o resultado se alguem trocasse a soma por
    // contagem de maquinas por engano).
    const summary = buildDeviceReportSummary(HETEROGENEOUS_FLEET)
    const naiveDeviceCount = HETEROGENEOUS_FLEET.length

    expect(summary.storageCapacityGb).not.toBe(naiveDeviceCount)
    expect(summary.storageCapacityGb).toBeGreaterThan(naiveDeviceCount)
    expect(summary.storageCapacityGb).toBe(128 + 512 + 2048 + 4096 + 256)
  })
})
