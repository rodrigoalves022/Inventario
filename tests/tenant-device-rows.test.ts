import { describe, expect, it } from 'vitest'
import { buildTenantDeviceRow, type TenantDeviceForRow } from '@/lib/tenant-device-rows'
import { DEFAULT_ALERT_SETTINGS, type InventoryAlertSettings } from '@/lib/inventory-alerts'

/**
 * `buildTenantDeviceRow` foi extraida de `computers/page.tsx` para dar
 * paridade real (nao so visual) entre computadores e servidores na listagem
 * unificada `/assets` — o mesmo calculo de issues/status/disco que antes so
 * rodava para computadores agora roda para qualquer `Device`.
 */
const settings: InventoryAlertSettings = { ...DEFAULT_ALERT_SETTINGS }

// Timestamp relativo a "agora" (em vez de uma data fixa) — evita que o teste
// comece a falhar por "coleta atrasada" (stale_collection) conforme os dias
// passam entre execuções da suíte.
const RECENT_COLLECTION = new Date(Date.now() - 5 * 60 * 1000) // 5 min atrás

function makeDevice(overrides: Partial<TenantDeviceForRow> = {}): TenantDeviceForRow {
  return {
    id: 'dev-1',
    hostname: 'SRV-01',
    status: 'online',
    updatedAt: RECENT_COLLECTION,
    hardware: { sistema: 'Windows Server 2019', processador: 'Xeon E5', ramTotalGb: 32 },
    networks: [{ ip: '10.0.0.9' }],
    disks: [
      { espacoLivreGb: 50, capacidadeGb: 500, tipo: 'SSD' },
      { espacoLivreGb: 5, capacidadeGb: 1000, tipo: 'HDD' },
    ],
    logs: [{ coletadoEm: RECENT_COLLECTION }],
    ...overrides,
  }
}

describe('buildTenantDeviceRow', () => {
  it('mapeia os campos básicos do device para a linha de tabela', () => {
    const row = buildTenantDeviceRow(makeDevice(), settings, 'cliente-a')

    expect(row.id).toBe('dev-1')
    expect(row.hostname).toBe('SRV-01')
    expect(row.ip).toBe('10.0.0.9')
    expect(row.sistema).toBe('Windows Server 2019')
    expect(row.processador).toBe('Xeon E5')
    expect(row.ramTotalGb).toBe(32)
  })

  it('detailsPath aponta sempre para assets/<id>, independente do tenant', () => {
    const row = buildTenantDeviceRow(makeDevice(), settings, 'cliente-a')
    expect(row.detailsPath).toBe('/app/cliente-a/assets/dev-1')
  })

  it('lowestDiskFreeGb é o menor espaço livre entre os discos (funciona para servidor, não só computador)', () => {
    const row = buildTenantDeviceRow(makeDevice(), settings, 'cliente-a')
    expect(row.lowestDiskFreeGb).toBe(5)
  })

  it('ignora discos sem espaçoLivreGb ao calcular o menor valor', () => {
    const row = buildTenantDeviceRow(
      makeDevice({ disks: [{ espacoLivreGb: null, capacidadeGb: 500, tipo: 'SSD' }, { espacoLivreGb: 20, capacidadeGb: 200, tipo: 'SSD' }] }),
      settings,
      'cliente-a'
    )
    expect(row.lowestDiskFreeGb).toBe(20)
  })

  it('com alertsEnabled=true, deriva issues (ex: low_disk quando abaixo do threshold)', () => {
    const row = buildTenantDeviceRow(makeDevice(), settings, 'cliente-a')
    expect(row.issues.some((issue) => issue.code === 'low_disk')).toBe(true)
  })

  it('com alertsEnabled=false, nenhuma issue é calculada mesmo que o disco esteja baixo', () => {
    const disabledSettings: InventoryAlertSettings = { ...settings, alertsEnabled: false }
    const row = buildTenantDeviceRow(makeDevice(), disabledSettings, 'cliente-a')
    expect(row.issues).toEqual([])
  })

  it('effectiveStatus reflete o status bruto quando não há issues que o sobrescrevam', () => {
    const row = buildTenantDeviceRow(
      makeDevice({ status: 'online', disks: [{ espacoLivreGb: 100, capacidadeGb: 500, tipo: 'SSD' }] }),
      settings,
      'cliente-a'
    )
    expect(row.effectiveStatus).toBe('online')
  })
})
