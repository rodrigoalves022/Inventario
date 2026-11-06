import { describe, it, expect } from 'vitest'
import { calculateLicenseStatus, reconcileLicenses, type SoftwareLicenseRecord, type InstalledSoftwareRecord } from '@/lib/licenses'

describe('calculateLicenseStatus', () => {
  const now = new Date('2026-06-01T12:00:00Z')

  it('retorna EXPIRED quando a data de expiracao ja passou', () => {
    const res = calculateLicenseStatus({
      seatsPurchased: 10,
      seatsInstalled: 5,
      expiresAt: new Date('2026-05-01T00:00:00Z'),
      now,
    })
    expect(res.status).toBe('EXPIRED')
    expect(res.isExpired).toBe(true)
    expect(res.isExpiringSoon).toBe(false)
  })

  it('retorna OVERUSED quando ha mais instalacoes do que licencas compradas', () => {
    const res = calculateLicenseStatus({
      seatsPurchased: 5,
      seatsInstalled: 8,
      expiresAt: new Date('2026-12-31T00:00:00Z'),
      now,
    })
    expect(res.status).toBe('OVERUSED')
    expect(res.isExpired).toBe(false)
  })

  it('retorna UNUSED quando ha 0 instalacoes', () => {
    const res = calculateLicenseStatus({
      seatsPurchased: 10,
      seatsInstalled: 0,
      expiresAt: new Date('2026-12-31T00:00:00Z'),
      now,
    })
    expect(res.status).toBe('UNUSED')
  })

  it('retorna EXPIRING_SOON quando vence em ate 30 dias', () => {
    const res = calculateLicenseStatus({
      seatsPurchased: 10,
      seatsInstalled: 5,
      expiresAt: new Date('2026-06-20T00:00:00Z'), // 19 dias a frente
      now,
    })
    expect(res.status).toBe('EXPIRING_SOON')
    expect(res.isExpiringSoon).toBe(true)
  })

  it('retorna COMPLIANT quando instalacoes <= compradas e prazo em dia', () => {
    const res = calculateLicenseStatus({
      seatsPurchased: 10,
      seatsInstalled: 7,
      expiresAt: new Date('2027-01-01T00:00:00Z'),
      now,
    })
    expect(res.status).toBe('COMPLIANT')
    expect(res.isExpiringSoon).toBe(false)
    expect(res.isExpired).toBe(false)
  })
})

describe('reconcileLicenses', () => {
  const now = new Date('2026-06-01T12:00:00Z')

  const licenses: SoftwareLicenseRecord[] = [
    {
      id: 'lic-1',
      clientId: 'c1',
      softwareName: 'Microsoft Office 365',
      licenseKey: 'XXXXX-XXXXX',
      seatsPurchased: 5,
      contractRef: 'CTR-2026-01',
      supplier: 'Microsoft Direct',
      cost: 500,
      expiresAt: new Date('2026-12-31T00:00:00Z'),
      notes: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lic-2',
      clientId: 'c1',
      softwareName: 'Adobe Photoshop',
      licenseKey: null,
      seatsPurchased: 2,
      contractRef: 'CTR-2026-02',
      supplier: 'Adobe Systems',
      cost: 200,
      expiresAt: new Date('2026-06-15T00:00:00Z'), // Vence em 14 dias!
      notes: 'Creative Cloud Pro',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lic-3',
      clientId: 'c1',
      softwareName: 'AutoCAD',
      licenseKey: null,
      seatsPurchased: 1,
      contractRef: null,
      supplier: 'Autodesk',
      cost: 1200,
      expiresAt: null, // Vitalício
      notes: null,
      createdAt: now,
      updatedAt: now,
    },
  ]

  const installedSoftwares: InstalledSoftwareRecord[] = [
    // Office em 2 máquinas (dev-1 tem duas entradas mas deve contar apenas 1)
    { deviceId: 'dev-1', hostname: 'PC-JOAO', nome: 'Microsoft Office 365 - pt-br', versao: '16.0' },
    { deviceId: 'dev-1', hostname: 'PC-JOAO', nome: 'Microsoft Office 365 (64-bit)', versao: '16.0' },
    { deviceId: 'dev-2', hostname: 'PC-MARIA', nome: 'Microsoft Office 365', versao: '16.0' },

    // Photoshop em 3 máquinas (excede as 2 compradas!)
    { deviceId: 'dev-1', hostname: 'PC-JOAO', nome: 'Adobe Photoshop 2024', versao: '25.0' },
    { deviceId: 'dev-2', hostname: 'PC-MARIA', nome: 'Adobe Photoshop 2024', versao: '25.0' },
    { deviceId: 'dev-3', hostname: 'PC-DESIGN', nome: 'Adobe Photoshop 2024', versao: '25.0' },

    // AutoCAD: 0 instalações (ocioso)
  ]

  it('calcula instalacoes deduplicadas por maquina e status de cada licenca', () => {
    const { items, summary } = reconcileLicenses({ licenses, installedSoftwares, now })

    // Ordenação esperada: Photoshop (OVERUSED) vem primeiro
    expect(items[0].softwareName).toBe('Adobe Photoshop')
    expect(items[0].status).toBe('OVERUSED')
    expect(items[0].seatsPurchased).toBe(2)
    expect(items[0].seatsInstalled).toBe(3)
    expect(items[0].seatsAvailable).toBe(-1)
    expect(items[0].installedDevices).toHaveLength(3)

    // Office: COMPLIANT (2 instaladas de 5 compradas)
    const office = items.find((i) => i.id === 'lic-1')
    expect(office).toBeDefined()
    expect(office?.status).toBe('COMPLIANT')
    expect(office?.seatsInstalled).toBe(2)
    expect(office?.seatsAvailable).toBe(3)

    // AutoCAD: UNUSED (0 instaladas de 1 comprada)
    const cad = items.find((i) => i.id === 'lic-3')
    expect(cad).toBeDefined()
    expect(cad?.status).toBe('UNUSED')
    expect(cad?.seatsInstalled).toBe(0)
    expect(cad?.seatsAvailable).toBe(1)

    // Resumo
    expect(summary.totalPurchased).toBe(8)
    expect(summary.totalInstalled).toBe(5)
    expect(summary.overusedCount).toBe(1)
    expect(summary.compliantCount).toBe(1)
    expect(summary.unusedCount).toBe(1)
    expect(summary.totalCost).toBe(1900)
  })
})

