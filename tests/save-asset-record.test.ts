import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveAssetRecordAction } from '@/app/app/[clientSlug]/assets/[id]/actions'

// Sprint 10, item 7. RF013 — saveAssetRecordAction nunca teve teste
// automatizado. Cobre: canManageAssetRecord real (delega a canOperateTenant,
// lib/permissions.ts — NAO mockado aqui), assetRecordSchema real rejeitando
// payload invalido, e a reconfirmacao de tenant (o deviceId do formulario
// precisa pertencer ao clientSlug da URL, nao so a mesma Organization) —
// mesmo padrao anti-oraculo de tests/rotate-enrollment-key.test.ts e
// tests/tenant-device-metrics-route.test.ts.

type FakeClient = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }
type FakeDevice = { id: string; clientSlug: string; agentAuthActive: boolean; clientActive: boolean }
type FakeAssetRecord = Record<string, unknown> & { deviceId: string }

const { clients, devices, assetRecords, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const devices = new Map<string, FakeDevice>()
  const assetRecords = new Map<string, FakeAssetRecord>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const client = [...clients.values()].find((candidate) => candidate.slug === where.slug)
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
      // Formato real produzido por getTenantDeviceWhere(clientSlug) (lib/tenant-scope.ts):
      // { id, agentAuth: { is: { client: { is: { slug, isActive } } }, isActive } }.
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            id: string
            agentAuth?: { is?: { client?: { is?: { slug?: string; isActive?: boolean } }; isActive?: boolean } }
          }
        }) => {
          const device = devices.get(where.id)
          if (!device) return null
          const requiredSlug = where.agentAuth?.is?.client?.is?.slug
          if (device.clientSlug !== requiredSlug) return null
          if (!device.agentAuthActive || !device.clientActive) return null
          return { id: device.id }
        }
      ),
    },
    assetRecord: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { deviceId: string }
          create: FakeAssetRecord
          update: Record<string, unknown>
        }) => {
          const existing = assetRecords.get(where.deviceId)
          const record = existing ? { ...existing, ...update } : { ...create }
          assetRecords.set(where.deviceId, record)
          return record
        }
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
  }

  return { clients, devices, assetRecords, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = { name: 'Cliente', organizationId: 'org-a', isActive: true, ...overrides }
  clients.set(client.id, client)
  return client
}

function seedDevice(overrides: Partial<FakeDevice> & { id: string; clientSlug: string }) {
  const device: FakeDevice = { agentAuthActive: true, clientActive: true, ...overrides }
  devices.set(device.id, device)
  return device
}

function buildFormData(overrides: Partial<Record<string, string>> = {}) {
  const formData = new FormData()
  formData.set('tenantSlug', overrides.tenantSlug ?? 'cliente-a')
  formData.set('deviceId', overrides.deviceId ?? 'device-1')
  formData.set('etiqueta', overrides.etiqueta ?? 'PAT-001')
  formData.set('dataCompra', overrides.dataCompra ?? '')
  formData.set('notaFiscal', overrides.notaFiscal ?? '')
  formData.set('fornecedor', overrides.fornecedor ?? '')
  formData.set('valor', overrides.valor ?? '1500.50')
  formData.set('garantiaAte', overrides.garantiaAte ?? '')
  formData.set('centroCusto', overrides.centroCusto ?? '')
  formData.set('localizacao', overrides.localizacao ?? '')
  formData.set('responsavel', overrides.responsavel ?? '')
  formData.set('observacoes', overrides.observacoes ?? '')
  return formData
}

beforeEach(() => {
  clients.clear()
  devices.clear()
  assetRecords.clear()
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('saveAssetRecordAction — RN014 (canManageAssetRecord delega a canOperateTenant, real)', () => {
  it('ORG_OPERATOR consegue salvar o patrimonio (papel mais permissivo que canManageTenant)', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await saveAssetRecordAction({ status: 'idle', message: null }, buildFormData())

    expect(result.status).toBe('success')
    expect(assetRecords.get('device-1')).toMatchObject({ etiqueta: 'PAT-001', valor: 1500.5 })
  })

  it('ator de OUTRA organizacao e bloqueado, sem nenhuma escrita no banco', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a' })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const result = await saveAssetRecordAction({ status: 'idle', message: null }, buildFormData())

    expect(result.status).toBe('error')
    expect(assetRecords.has('device-1')).toBe(false)
    // Bloqueado no guard, antes de sequer consultar o dispositivo.
    expect(fakePrisma.device.findFirst).not.toHaveBeenCalled()
  })

  it('CLIENT_VIEWER (papel do portal, fora de canOperateTenant) nunca consegue salvar', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a' })
    sessionRef.user = {
      id: 'user-viewer',
      email: 'portal@org-a.local',
      role: 'CLIENT_VIEWER',
      organizationId: 'org-a',
      clientId: 'client-a',
    }

    const result = await saveAssetRecordAction({ status: 'idle', message: null }, buildFormData())

    expect(result.status).toBe('error')
    expect(assetRecords.has('device-1')).toBe(false)
  })
})

describe('saveAssetRecordAction — assetRecordSchema real rejeita payload invalido antes de qualquer escrita', () => {
  it('valor negativo e rejeitado, upsert nunca chamado', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await saveAssetRecordAction({ status: 'idle', message: null }, buildFormData({ valor: '-10' }))

    expect(result.status).toBe('error')
    expect(fakePrisma.assetRecord.upsert).not.toHaveBeenCalled()
    expect(assetRecords.has('device-1')).toBe(false)
  })

  it('observacoes acima de 2000 caracteres e rejeitada, upsert nunca chamado', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await saveAssetRecordAction(
      { status: 'idle', message: null },
      buildFormData({ observacoes: 'x'.repeat(2001) })
    )

    expect(result.status).toBe('error')
    expect(fakePrisma.assetRecord.upsert).not.toHaveBeenCalled()
  })
})

describe('saveAssetRecordAction — reconfirmacao de tenant (deviceId precisa pertencer ao clientSlug da URL)', () => {
  it('deviceId de OUTRO tenant (mesmo com ator autorizado no tenant da URL) e recusado, sem escrita', async () => {
    // Ambos os tenants na MESMA organizacao — isolando propositalmente o
    // teste do caso "organizacao errada" (ja coberto acima): aqui o guard de
    // organizacao passaria, so a reconfirmacao de deviceId x clientSlug deve barrar.
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedClient({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-a' })
    seedDevice({ id: 'device-b', clientSlug: 'cliente-b' }) // pertence ao OUTRO tenant
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await saveAssetRecordAction(
      { status: 'idle', message: null },
      buildFormData({ tenantSlug: 'cliente-a', deviceId: 'device-b' })
    )

    expect(result.status).toBe('error')
    expect(result.message).toMatch(/não encontrada/i)
    expect(fakePrisma.assetRecord.upsert).not.toHaveBeenCalled()
    expect(assetRecords.has('device-b')).toBe(false)
  })

  it('deviceId inexistente e recusado da mesma forma', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await saveAssetRecordAction(
      { status: 'idle', message: null },
      buildFormData({ tenantSlug: 'cliente-a', deviceId: 'nao-existe' })
    )

    expect(result.status).toBe('error')
    expect(fakePrisma.assetRecord.upsert).not.toHaveBeenCalled()
  })
})
