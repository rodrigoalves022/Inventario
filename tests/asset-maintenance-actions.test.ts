import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAssetMaintenanceAction,
  deleteAssetMaintenanceAction,
} from '@/app/app/[clientSlug]/assets/[id]/actions'

type FakeClient = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }
type FakeDevice = { id: string; clientSlug: string; agentAuthActive: boolean; clientActive: boolean; hostname: string }
type FakeAssetRecord = { id: string; deviceId: string }
type FakeAssetMaintenance = {
  id: string
  assetRecordId: string
  type: string
  title: string
  description?: string | null
  cost?: number | null
  performedBy?: string | null
  startDate: Date
  completedDate?: Date | null
  status: string
}

const { clients, devices, assetRecords, maintenances, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const devices = new Map<string, FakeDevice>()
  const assetRecords = new Map<string, FakeAssetRecord>()
  const maintenances = new Map<string, FakeAssetMaintenance>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const client = [...clients.values()].find((c) => c.slug === where.slug)
        if (!client) return null
        return {
          id: client.id,
          name: client.name,
          slug: client.slug,
          isActive: client.isActive,
          organizationId: client.organizationId,
          organization: { isActive: true },
        }
      }),
    },
    device: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; agentAuth?: { is?: { client?: { is?: { slug?: string } } } } } }) => {
        const device = devices.get(where.id)
        if (!device) return null
        const reqSlug = where.agentAuth?.is?.client?.is?.slug
        if (reqSlug && device.clientSlug !== reqSlug) return null
        return { id: device.id, hostname: device.hostname }
      }),
    },
    assetRecord: {
      upsert: vi.fn(async ({ where }: { where: { deviceId: string } }) => {
        let record = assetRecords.get(where.deviceId)
        if (!record) {
          record = { id: `asset-${where.deviceId}`, deviceId: where.deviceId }
          assetRecords.set(where.deviceId, record)
        }
        return record
      }),
    },
    assetMaintenance: {
      create: vi.fn(async ({ data }: { data: Omit<FakeAssetMaintenance, 'id'> }) => {
        const id = `maint-${Date.now()}-${Math.random()}`
        const item: FakeAssetMaintenance = { id, ...data }
        maintenances.set(id, item)
        return item
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; assetRecord?: { deviceId?: string } } }) => {
        const m = maintenances.get(where.id)
        if (!m) return null
        if (where.assetRecord?.deviceId) {
          const ar = assetRecords.get(where.assetRecord.deviceId)
          if (!ar || ar.id !== m.assetRecordId) return null
        }
        return { id: m.id, title: m.title }
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const item = maintenances.get(where.id)
        if (item) maintenances.delete(where.id)
        return item
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
  }

  return { clients, devices, assetRecords, maintenances, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seed() {
  clients.clear()
  devices.clear()
  assetRecords.clear()
  maintenances.clear()
  auditLogs.length = 0

  const client: FakeClient = { id: 'c1', name: 'Empresa A', slug: 'empresa-a', organizationId: 'org-1', isActive: true }
  clients.set(client.id, client)

  const device: FakeDevice = {
    id: 'dev-1',
    hostname: 'SRV-DATABASE',
    clientSlug: 'empresa-a',
    agentAuthActive: true,
    clientActive: true,
  }
  devices.set(device.id, device)

  sessionRef.user = { id: 'u1', email: 'admin@org.local', role: 'ORG_ADMIN', organizationId: 'org-1' }
}

describe('createAssetMaintenanceAction', () => {
  beforeEach(() => seed())

  it('cria manutencao preventiva com sucesso e gera log de auditoria', async () => {
    const fd = new FormData()
    fd.set('tenantSlug', 'empresa-a')
    fd.set('deviceId', 'dev-1')
    fd.set('type', 'PREVENTIVE')
    fd.set('title', 'Troca de pasta térmica e limpeza interna')
    fd.set('description', 'Realizado no data center pela equipe local')
    fd.set('cost', '180.00')
    fd.set('performedBy', 'Técnico Carlos')
    fd.set('status', 'COMPLETED')

    const res = await createAssetMaintenanceAction({ status: 'idle', message: null }, fd)
    expect(res.status).toBe('success')
    expect(res.message).toBe('Manutenção registrada com sucesso.')

    expect(maintenances.size).toBe(1)
    const [maint] = maintenances.values()
    expect(maint.title).toBe('Troca de pasta térmica e limpeza interna')
    expect(maint.type).toBe('PREVENTIVE')
    expect(maint.cost).toBe(180)
    expect(maint.performedBy).toBe('Técnico Carlos')

    expect(auditLogs.some((l) => l.action === 'asset.maintenance_create')).toBe(true)
  })

  it('rejeita quando o usuario nao tem permissao para operar o tenant (CLIENT_VIEWER)', async () => {
    sessionRef.user = { id: 'viewer', email: 'viewer@empresa.com', role: 'CLIENT_VIEWER', clientId: 'c1' }

    const fd = new FormData()
    fd.set('tenantSlug', 'empresa-a')
    fd.set('deviceId', 'dev-1')
    fd.set('type', 'UPGRADE')
    fd.set('title', 'Upgrade de SSD')

    const res = await createAssetMaintenanceAction({ status: 'idle', message: null }, fd)
    expect(res.status).toBe('error')
    expect(res.message).toContain('Você não pode registrar manutenções')
    expect(maintenances.size).toBe(0)
  })

  it('rejeita payload sem titulo ou com tipo invalido', async () => {
    const fd = new FormData()
    fd.set('tenantSlug', 'empresa-a')
    fd.set('deviceId', 'dev-1')
    fd.set('type', 'TIPO_INVALIDO')
    fd.set('title', '')

    const res = await createAssetMaintenanceAction({ status: 'idle', message: null }, fd)
    expect(res.status).toBe('error')
    expect(maintenances.size).toBe(0)
  })
})

describe('deleteAssetMaintenanceAction', () => {
  beforeEach(() => {
    seed()
    assetRecords.set('dev-1', { id: 'asset-dev-1', deviceId: 'dev-1' })
    maintenances.set('m-1', {
      id: 'm-1',
      assetRecordId: 'asset-dev-1',
      type: 'CORRECTIVE',
      title: 'Substituição de fonte queimada',
      startDate: new Date(),
      status: 'COMPLETED',
    })
  })

  it('exclui registro de manutencao pertencente ao ativo', async () => {
    const fd = new FormData()
    fd.set('tenantSlug', 'empresa-a')
    fd.set('deviceId', 'dev-1')
    fd.set('maintenanceId', 'm-1')

    const res = await deleteAssetMaintenanceAction({ status: 'idle', message: null }, fd)
    expect(res.status).toBe('success')
    expect(res.message).toBe('Registro de manutenção excluído.')
    expect(maintenances.has('m-1')).toBe(false)
    expect(auditLogs.some((l) => l.action === 'asset.maintenance_delete')).toBe(true)
  })

  it('rejeita exclusao se o registro pertencer a outro dispositivo', async () => {
    // Altera assetRecordId para outro
    maintenances.set('m-2', {
      id: 'm-2',
      assetRecordId: 'asset-outro',
      type: 'CORRECTIVE',
      title: 'Manutencao outro',
      startDate: new Date(),
      status: 'COMPLETED',
    })

    const fd = new FormData()
    fd.set('tenantSlug', 'empresa-a')
    fd.set('deviceId', 'dev-1')
    fd.set('maintenanceId', 'm-2')

    const res = await deleteAssetMaintenanceAction({ status: 'idle', message: null }, fd)
    expect(res.status).toBe('error')
    expect(res.message).toBe('Registro de manutenção não encontrado.')
    expect(maintenances.has('m-2')).toBe(true)
  })
})
