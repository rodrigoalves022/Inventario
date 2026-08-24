import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rotateEnrollmentKeyAction } from '@/app/clients/actions'

// aes-256-gcm precisa de um segredo mestre (lib/provisioning-credentials.ts)
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

type FakeClient = {
  id: string
  name: string
  slug: string
  organizationId: string
  enrollmentKeyHash: string
  activeProvisioningKeyEnc: string | null
}

// vi.mock(...) e hoisted para o topo do arquivo pelo Vitest, antes de
// qualquer import estatico. Estado mutavel usado dentro das factories de
// mock precisa vir de vi.hoisted() por isso — senao a factory fecharia
// sobre uma const ainda nao inicializada (TDZ) no momento em que o import
// real (ex.: '@/app/clients/actions') e resolvido.
const { clients, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const client = clients.get(where.id)
        return client ? { ...client } : null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeClient> }) => {
        const client = clients.get(where.id)
        if (client) Object.assign(client, data)
        return client
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $executeRaw: vi.fn(async () => undefined),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { clients, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClient> & { id: string }) {
  const client: FakeClient = {
    name: 'Cliente',
    slug: 'cliente',
    organizationId: 'org-a',
    enrollmentKeyHash: 'hash-original',
    activeProvisioningKeyEnc: null,
    ...overrides,
  }
  clients.set(client.id, client)
  return client
}

function buildFormData(clientId: string) {
  const formData = new FormData()
  formData.set('serverUrl', 'https://inventario.example.com')
  formData.set('clientId', clientId)
  return formData
}

beforeEach(() => {
  clients.clear()
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('rotateEnrollmentKeyAction — isolamento multi-tenant (canManageTenant)', () => {
  it('ORG_ADMIN de uma organizacao NAO consegue rotacionar a chave de um cliente de outra organizacao', async () => {
    const client = seedClient({ id: 'client-b', organizationId: 'org-b', enrollmentKeyHash: 'hash-original' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await rotateEnrollmentKeyAction(
      { error: null, message: null, package: null },
      buildFormData('client-b')
    )

    expect(result.error).toBeTruthy()
    expect(result.package).toBeNull()
    // Nenhuma chave foi rotacionada no banco (nem hash nem credencial ativa).
    expect(clients.get('client-b')?.enrollmentKeyHash).toBe('hash-original')
    expect(client.activeProvisioningKeyEnc).toBeNull()
    expect(auditLogs).toHaveLength(0)
  })

  it('ORG_ADMIN da PROPRIA organizacao consegue rotacionar e gera AuditLog', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a', enrollmentKeyHash: 'hash-original' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await rotateEnrollmentKeyAction(
      { error: null, message: null, package: null },
      buildFormData('client-a')
    )

    expect(result.error).toBeNull()
    expect(result.package?.enrollmentKey).toBeTruthy()
    expect(clients.get('client-a')?.enrollmentKeyHash).not.toBe('hash-original')

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'credentials.rotate',
      targetType: 'client',
      targetId: 'client-a',
      clientId: 'client-a',
    })
  })

  it('PLATFORM_ADMIN consegue rotacionar a chave de qualquer organizacao', async () => {
    seedClient({ id: 'client-b', organizationId: 'org-b', enrollmentKeyHash: 'hash-original' })
    sessionRef.user = { id: 'user-platform', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }

    const result = await rotateEnrollmentKeyAction(
      { error: null, message: null, package: null },
      buildFormData('client-b')
    )

    expect(result.error).toBeNull()
    expect(clients.get('client-b')?.enrollmentKeyHash).not.toBe('hash-original')
    expect(auditLogs).toHaveLength(1)
  })

  it('CLIENT_VIEWER nunca consegue rotacionar (fora do escopo de canManageTenant)', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a', enrollmentKeyHash: 'hash-original' })
    sessionRef.user = { id: 'user-viewer', email: 'portal@org-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a' }

    const result = await rotateEnrollmentKeyAction(
      { error: null, message: null, package: null },
      buildFormData('client-a')
    )

    expect(result.error).toBeTruthy()
    expect(clients.get('client-a')?.enrollmentKeyHash).toBe('hash-original')
    expect(auditLogs).toHaveLength(0)
  })
})
