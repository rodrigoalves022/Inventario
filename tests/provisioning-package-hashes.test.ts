import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint A4, item 12 (ressalva 8). O pacote de instalacao (criacao de
// cliente, rotacao de chave e "Ver credenciais") passa a levar o SHA-256 dos
// binarios publicados, lido no servidor por getAgentBinarySha256: `string`
// quando o binario existe, `null` quando falta. Nenhum outro campo do pacote
// nem do AuditLog muda.

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

const { hashes, clients, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const hashes: { windows: string | null; linux: string | null } = { windows: null, linux: null }
  const clients = new Map<string, Record<string, unknown>>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: string } }) => {
        const found = [...clients.values()].find(
          (c) => (where.slug !== undefined && c.slug === where.slug) || (where.id !== undefined && c.id === where.id)
        )
        return found ? { ...found } : null
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const client = { id: 'client-new', activeProvisioningKeyEnc: null, ...data }
        clients.set('client-new', client)
        return { ...client }
      }),
      update: vi.fn(async () => undefined),
    },
    organization: {
      findUnique: vi.fn(async () => ({ id: 'org-a', name: 'Org A', slug: 'org-a', type: 'MSP' })),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $executeRaw: vi.fn(async () => undefined),
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, id: string) => {
      const client = clients.get(id)
      return client ? [client] : []
    }),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { hashes, clients, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/agent-binary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/agent-binary')>()),
  getAgentBinarySha256: vi.fn(async (platform: 'windows' | 'linux' = 'windows') =>
    platform === 'linux' ? hashes.linux : hashes.windows
  ),
  // getPublishedAgentHashes chama getAgentBinarySha256 dentro do proprio
  // modulo (o mock acima nao a alcanca); a composicao e testada em
  // tests/agent-binary-platforms.test.ts.
  getPublishedAgentHashes: vi.fn(async () => ({ windowsSha256: hashes.windows, linuxSha256: hashes.linux })),
}))

import { createClientAction, rotateEnrollmentKeyAction } from '@/app/admin/clients/actions'
import { GET as credentialsGET } from '@/app/api/clients/[id]/credentials/route'
import { encryptProvisioningSecret } from '@/lib/provisioning-credentials'

const SERVER_URL = 'https://inventario.example.com'
const WINDOWS_HASH = '1'.repeat(64)
const LINUX_HASH = '2'.repeat(64)
const initialState = { error: null, message: null, package: null }

const EXPECTED_PACKAGE_KEYS = [
  'bootstrapCommand',
  'bootstrapUrl',
  'clientId',
  'clientName',
  'clientSlug',
  'enrollmentKey',
  'installCommand',
  'linuxBootstrapCommand',
  'linuxBootstrapUrl',
  'linuxInstallCommand',
  'linuxSha256',
  'windowsSha256',
]

function seedClient() {
  clients.set('client-a', {
    id: 'client-a',
    name: 'Teste A0 Rotação',
    slug: 'teste-a0-rotacao',
    organizationId: 'org-a',
    enrollmentKeyHash: 'hash-original',
    activeProvisioningKeyEnc: encryptProvisioningSecret({ enrollmentKey: 'a'.repeat(64) }),
    activeProvisioningSetAt: new Date('2026-10-10T10:00:00.000Z'),
  })
}

beforeEach(() => {
  hashes.windows = WINDOWS_HASH
  hashes.linux = LINUX_HASH
  clients.clear()
  auditLogs.length = 0
  sessionRef.user = { id: 'admin-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
  vi.clearAllMocks()
})

describe('createClientAction — hashes no pacote', () => {
  it('leva windowsSha256 e linuxSha256 dos binarios publicados; demais campos intactos', async () => {
    const formData = new FormData()
    formData.set('serverUrl', SERVER_URL)
    formData.set('name', 'Cliente Hash Ltda')

    const result = await createClientAction(initialState, formData)

    expect(result.error).toBeNull()
    expect(result.package?.windowsSha256).toBe(WINDOWS_HASH)
    expect(result.package?.linuxSha256).toBe(LINUX_HASH)
    expect(Object.keys(result.package ?? {}).sort()).toEqual(EXPECTED_PACKAGE_KEYS)
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({ action: 'client.create' })
    expect(JSON.parse(String(auditLogs[0].metadataJson))).toEqual({ clientSlug: 'cliente-hash-ltda' })
    expect(JSON.stringify(auditLogs[0])).not.toContain(WINDOWS_HASH)
    expect(JSON.stringify(auditLogs[0])).not.toContain(LINUX_HASH)
  })

  it('binario ausente → null naquela plataforma', async () => {
    hashes.linux = null
    const formData = new FormData()
    formData.set('serverUrl', SERVER_URL)
    formData.set('name', 'Cliente Sem Linux')

    const result = await createClientAction(initialState, formData)

    expect(result.package?.windowsSha256).toBe(WINDOWS_HASH)
    expect(result.package?.linuxSha256).toBeNull()
  })
})

describe('rotateEnrollmentKeyAction — hashes no pacote', () => {
  it('leva os dois hashes; AuditLog credentials.rotate com o metadata de sempre', async () => {
    seedClient()
    const formData = new FormData()
    formData.set('serverUrl', SERVER_URL)
    formData.set('clientId', 'client-a')

    const result = await rotateEnrollmentKeyAction(initialState, formData)

    expect(result.error).toBeNull()
    expect(result.package?.windowsSha256).toBe(WINDOWS_HASH)
    expect(result.package?.linuxSha256).toBe(LINUX_HASH)
    expect(Object.keys(result.package ?? {}).sort()).toEqual(EXPECTED_PACKAGE_KEYS)
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({ action: 'credentials.rotate' })
    expect(JSON.parse(String(auditLogs[0].metadataJson))).toEqual({ clientSlug: 'teste-a0-rotacao' })
  })

  it('os dois binarios ausentes → null nos dois', async () => {
    seedClient()
    hashes.windows = null
    hashes.linux = null
    const formData = new FormData()
    formData.set('serverUrl', SERVER_URL)
    formData.set('clientId', 'client-a')

    const result = await rotateEnrollmentKeyAction(initialState, formData)

    expect(result.package?.windowsSha256).toBeNull()
    expect(result.package?.linuxSha256).toBeNull()
  })
})

describe('GET /api/clients/[id]/credentials — hashes no pacote', () => {
  function call() {
    const req = new NextRequest(`${SERVER_URL}/api/clients/client-a/credentials?serverUrl=${encodeURIComponent(SERVER_URL)}`)
    return credentialsGET(req, { params: Promise.resolve({ id: 'client-a' }) } as never)
  }

  it('pacote available leva windowsSha256 e linuxSha256; resposta e AuditLog sem outros campos novos', async () => {
    seedClient()
    const res = await call()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; generatedAt: string; package: Record<string, unknown> }

    expect(Object.keys(body).sort()).toEqual(['generatedAt', 'package', 'status'])
    expect(body.package.windowsSha256).toBe(WINDOWS_HASH)
    expect(body.package.linuxSha256).toBe(LINUX_HASH)
    expect(Object.keys(body.package).sort()).toEqual(EXPECTED_PACKAGE_KEYS)
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({ action: 'credentials.view' })
    expect(JSON.parse(String(auditLogs[0].metadataJson))).toEqual({ clientSlug: 'teste-a0-rotacao', status: 'available' })
  })

  it('binario Windows ausente → windowsSha256 null', async () => {
    seedClient()
    hashes.windows = null
    const res = await call()
    const body = (await res.json()) as { package: Record<string, unknown> }
    expect(body.package.windowsSha256).toBeNull()
    expect(body.package.linuxSha256).toBe(LINUX_HASH)
  })
})
