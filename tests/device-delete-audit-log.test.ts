import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 10, item 11 (RF022): cobertura de AuditLog para exclusao de Device
// (deleteTenantAssetAction) — o ponto que faltava teste, fora do que os
// itens 7 (AssetRecord) e 9 (comandos) ja cobrem em seus proprios arquivos.

type FakeAgentAuth = { clientId: string }
type FakeDevice = { id: string; hostname: string; clientSlug: string; agentAuth: FakeAgentAuth }
type FakeClientCtx = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }

const { devicesDb, clientsDb, auditLogs, sessionRef, fakePrisma, redirectCalls } = vi.hoisted(() => {
  const devicesDb = new Map<string, FakeDevice>()
  const clientsDb = new Map<string, FakeClientCtx>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const redirectCalls: string[] = []

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const client = [...clientsDb.values()].find((c) => c.slug === where.slug)
        if (!client) return null
        return { ...client, organization: { isActive: true } }
      }),
    },
    device: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; agentAuth?: { is?: { client?: { is?: { slug?: string } } } } } }) => {
        const device = devicesDb.get(where.id)
        const requiredSlug = where.agentAuth?.is?.client?.is?.slug
        if (!device || device.clientSlug !== requiredSlug) return null
        return { id: device.id, hostname: device.hostname, agentAuth: { clientId: device.agentAuth.clientId } }
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        devicesDb.delete(where.id)
        return {}
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { devicesDb, clientsDb, auditLogs, sessionRef, fakePrisma, redirectCalls }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    redirectCalls.push(path)
    const err = new Error('NEXT_REDIRECT')
    ;(err as unknown as { digest: string }).digest = 'NEXT_REDIRECT'
    throw err
  }),
  notFound: vi.fn(() => {
    const err = new Error('NEXT_NOT_FOUND')
    ;(err as unknown as { digest: string }).digest = 'NEXT_NOT_FOUND'
    throw err
  }),
}))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClientCtx> & { id: string; slug: string }) {
  const client: FakeClientCtx = { name: 'Cliente', organizationId: 'org-a', isActive: true, ...overrides }
  clientsDb.set(client.id, client)
  return client
}

function seedDevice(overrides: Partial<FakeDevice> & { id: string; clientSlug: string }) {
  const device: FakeDevice = { hostname: 'HOST-1', agentAuth: { clientId: 'client-a' }, ...overrides }
  devicesDb.set(device.id, device)
  return device
}

function buildFormData(tenantSlug: string, assetId: string) {
  const formData = new FormData()
  formData.set('tenantSlug', tenantSlug)
  formData.set('assetId', assetId)
  return formData
}

beforeEach(() => {
  devicesDb.clear()
  clientsDb.clear()
  auditLogs.length = 0
  redirectCalls.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('deleteTenantAssetAction — AuditLog device.delete', () => {
  it('ORG_ADMIN da organizacao dona do tenant exclui o Device e grava AuditLog device.delete com targetId/clientId corretos', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'PC-EXCLUIR', agentAuth: { clientId: 'client-a' } })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { deleteTenantAssetAction } = await import('@/app/app/[clientSlug]/assets/[id]/actions')

    await expect(
      deleteTenantAssetAction({ status: 'idle', message: null }, buildFormData('cliente-a', 'device-1'))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(devicesDb.has('device-1')).toBe(false)
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'device.delete',
      targetType: 'device',
      targetId: 'device-1',
      clientId: 'client-a',
      actorEmail: 'admin@org-a.local',
    })
    expect(redirectCalls).toHaveLength(1)
  })

  it('ator de outra organizacao NAO exclui o Device nem grava AuditLog', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuth: { clientId: 'client-a' } })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const { deleteTenantAssetAction } = await import('@/app/app/[clientSlug]/assets/[id]/actions')

    const result = await deleteTenantAssetAction({ status: 'idle', message: null }, buildFormData('cliente-a', 'device-1'))

    expect(result.status).toBe('error')
    expect(devicesDb.has('device-1')).toBe(true)
    expect(auditLogs).toHaveLength(0)
  })
})
