import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveLicenseAction, deleteLicenseAction } from '@/app/app/[clientSlug]/software/licenses/actions'

const licenses: any[] = []
const auditLogs: any[] = []

vi.mock('@/lib/prisma', () => ({
  default: {
    softwareLicense: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; clientId: string } }) => {
        return licenses.find((l) => l.id === where.id && l.clientId === where.clientId) ?? null
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const row = { id: `lic-${licenses.length + 1}`, ...data }
        licenses.push(row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const item = licenses.find((l) => l.id === where.id)
        if (item) Object.assign(item, data)
        return item
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const idx = licenses.findIndex((l) => l.id === where.id)
        if (idx !== -1) return licenses.splice(idx, 1)[0]
        return null
      }),
    },
  },
}))

let mockUser: any = { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' }

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (mockUser ? { user: mockUser } : null)),
}))

vi.mock('@/lib/tenant-context', () => ({
  getTenantContext: vi.fn(async (slug: string) => {
    if (slug === 'demo') {
      return { id: 'client-1', slug: 'demo', organizationId: 'org-1', name: 'Demo Client' }
    }
    return null
  }),
}))

vi.mock('@/lib/audit-log', () => ({
  recordAuditLog: vi.fn(async (entry: any) => {
    auditLogs.push(entry)
  }),
  getSessionAuditActor: vi.fn(() => ({
    userId: 'u1',
    userName: 'Admin',
    userEmail: 'admin@example.com',
  })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Software Licenses Server Actions (Sprint A81)', () => {
  beforeEach(() => {
    licenses.length = 0
    auditLogs.length = 0
    mockUser = { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' }
  })

  it('bloqueia usuario sem permissao (CLIENT_VIEWER)', async () => {
    mockUser = { id: 'u2', role: 'CLIENT_VIEWER', organizationId: 'org-1', clientId: 'client-1' }
    const fd = new FormData()
    fd.set('softwareName', 'Figma Pro')
    fd.set('seatsPurchased', '5')

    const res = await saveLicenseAction('demo', fd)
    expect(res.status).toBe('error')
    expect(res.message).toContain('Você não tem permissão')
    expect(licenses).toHaveLength(0)
  })

  it('cria uma nova licenca com auditoria quando dados sao validos', async () => {
    const fd = new FormData()
    fd.set('softwareName', 'Microsoft Office 365')
    fd.set('licenseKey', 'AAAA-BBBB-CCCC')
    fd.set('seatsPurchased', '10')
    fd.set('contractRef', 'NF-1020')
    fd.set('supplier', 'SND Distribuidora')
    fd.set('cost', '1500.50')
    fd.set('expiresAt', '2027-12-31')
    fd.set('notes', 'Contrato corporativo anual')

    const res = await saveLicenseAction('demo', fd)
    expect(res.status).toBe('success')
    expect(licenses).toHaveLength(1)
    expect(licenses[0].softwareName).toBe('Microsoft Office 365')
    expect(licenses[0].seatsPurchased).toBe(10)
    expect(licenses[0].cost).toBe(1500.5)

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0].action).toBe('license.create')
    expect(auditLogs[0].targetName).toBe('Microsoft Office 365')
  })

  it('atualiza uma licenca existente com auditoria', async () => {
    licenses.push({
      id: 'lic-orig',
      clientId: 'client-1',
      softwareName: 'Adobe Creative Cloud',
      licenseKey: 'OLD-KEY',
      seatsPurchased: 2,
      contractRef: null,
      supplier: null,
      cost: 400,
      expiresAt: null,
      notes: null,
    })

    const fd = new FormData()
    fd.set('id', 'lic-orig')
    fd.set('softwareName', 'Adobe Creative Cloud')
    fd.set('seatsPurchased', '5') // Upgrade de quantidade
    fd.set('cost', '1000')

    const res = await saveLicenseAction('demo', fd)
    expect(res.status).toBe('success')
    expect(licenses[0].seatsPurchased).toBe(5)
    expect(licenses[0].cost).toBe(1000)

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0].action).toBe('license.update')
  })

  it('exclui uma licenca com auditoria', async () => {
    licenses.push({
      id: 'lic-del',
      clientId: 'client-1',
      softwareName: 'WinRAR',
      seatsPurchased: 1,
    })

    const res = await deleteLicenseAction('demo', 'lic-del')
    expect(res.status).toBe('success')
    expect(licenses).toHaveLength(0)

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0].action).toBe('license.delete')
    expect(auditLogs[0].targetName).toBe('WinRAR')
  })
})

