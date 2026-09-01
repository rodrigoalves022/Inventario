import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 10, item 4. `createClientAction` (app/admin/clients/actions.ts, pos-rename
// da Sprint 5) e o "wizard" de criacao de tenant (RF002) — ate esta sprint so
// `rotateEnrollmentKeyAction`/`revokeAgentAuthAction` (mesmo arquivo) tinham teste;
// a criacao em si, incluindo o guard mais permissivo `hasClientsAdminAccess`
// (PLATFORM_ADMIN/ORG_ADMIN, diferente do canManageTenant usado nas outras duas
// actions), nunca foi exercitada.
//
// aes-256-gcm (lib/provisioning-credentials.ts) precisa de um segredo mestre.
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

type FakeClient = {
  id: string
  name: string
  slug: string
  organizationId: string
  enrollmentKeyHash: string
  activeProvisioningKeyEnc: string | null
}

type FakeOrganization = { id: string; name: string; slug: string; type: string }

const { clients, organizations, auditLogs, sessionRef, fakePrisma, nextIdRef } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const organizations = new Map<string, FakeOrganization>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const nextIdRef = { value: 1 }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: string } }) => {
        const found = [...clients.values()].find(
          (c) => (where.slug !== undefined && c.slug === where.slug) || (where.id !== undefined && c.id === where.id)
        )
        return found ? { ...found } : null
      }),
      create: vi.fn(async ({ data }: { data: Omit<FakeClient, 'id' | 'activeProvisioningKeyEnc'> }) => {
        const client: FakeClient = {
          id: `client-${nextIdRef.value++}`,
          activeProvisioningKeyEnc: null,
          ...data,
        }
        clients.set(client.id, client)
        return { ...client }
      }),
    },
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const found = [...organizations.values()].find((o) => o.slug === where.slug)
        return found ? { ...found } : null
      }),
      create: vi.fn(async ({ data }: { data: Omit<FakeOrganization, 'id'> }) => {
        const org: FakeOrganization = { id: `org-${nextIdRef.value++}`, ...data }
        organizations.set(org.id, org)
        return { ...org }
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

  return { clients, organizations, auditLogs, sessionRef, fakePrisma, nextIdRef }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedOrganization(overrides: Partial<FakeOrganization> & { id: string }) {
  const org: FakeOrganization = { name: 'Organizacao', slug: 'org-slug', type: 'MSP', ...overrides }
  organizations.set(org.id, org)
  return org
}

function buildFormData(overrides: Partial<{ serverUrl: string; name: string; slug: string }> = {}) {
  const formData = new FormData()
  formData.set('serverUrl', overrides.serverUrl ?? 'https://inventario.example.com')
  formData.set('name', overrides.name ?? 'Cliente Novo Ltda')
  if (overrides.slug !== undefined) formData.set('slug', overrides.slug)
  return formData
}

const initialState = { error: null, message: null, package: null }

beforeEach(() => {
  clients.clear()
  organizations.clear()
  auditLogs.length = 0
  sessionRef.user = null
  nextIdRef.value = 1
  vi.clearAllMocks()
})

describe('createClientAction — guard (RN015, hasClientsAdminAccess)', () => {
  it('PLATFORM_ADMIN consegue criar cliente', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }

    const result = await createClientAction(initialState, buildFormData({ name: 'Acme Ltda' }))

    expect(result.error).toBeNull()
    expect(result.package?.clientName).toBe('Acme Ltda')
    expect(clients.size).toBe(1)
  })

  it('ORG_ADMIN consegue criar cliente (dentro da propria organizacao)', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'admin-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createClientAction(initialState, buildFormData({ name: 'Cliente Org A' }))

    expect(result.error).toBeNull()
    const created = [...clients.values()][0]
    expect(created?.organizationId).toBe('org-a')
  })

  it('ORG_OPERATOR e rejeitado, sem escrever nada no banco', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'op-a', email: 'op@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await createClientAction(initialState, buildFormData({ name: 'Nao Deveria Existir' }))

    expect(result.error).toBeTruthy()
    expect(result.package).toBeNull()
    expect(clients.size).toBe(0)
  })

  it('CLIENT_VIEWER e rejeitado, sem escrever nada no banco', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'viewer-a', email: 'portal@org-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-x' }

    const result = await createClientAction(initialState, buildFormData({ name: 'Nao Deveria Existir' }))

    expect(result.error).toBeTruthy()
    expect(result.package).toBeNull()
    expect(clients.size).toBe(0)
  })

  it('sem sessao (nao autenticado) e rejeitado', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = null

    const result = await createClientAction(initialState, buildFormData({ name: 'Nao Deveria Existir' }))

    expect(result.error).toBeTruthy()
    expect(clients.size).toBe(0)
  })
})

describe('createClientAction — validacao Zod do payload', () => {
  beforeEach(() => {
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }
  })

  it('nome vazio e rejeitado antes de qualquer escrita', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')

    const result = await createClientAction(initialState, buildFormData({ name: '' }))

    expect(result.error).toBeTruthy()
    expect(result.package).toBeNull()
    expect(clients.size).toBe(0)
  })

  it('nome com menos de 3 caracteres e rejeitado', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')

    const result = await createClientAction(initialState, buildFormData({ name: 'AB' }))

    expect(result.error).toBeTruthy()
    expect(clients.size).toBe(0)
  })

  it('serverUrl invalido (nao-URL) e rejeitado', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')

    const result = await createClientAction(initialState, buildFormData({ serverUrl: 'nao-e-uma-url' }))

    expect(result.error).toBeTruthy()
    expect(clients.size).toBe(0)
  })

  it('slug explicito com caracteres invalidos (maiuscula/espaco/simbolo) e rejeitado', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')

    const result = await createClientAction(initialState, buildFormData({ name: 'Cliente X', slug: 'Slug Invalido!' }))

    expect(result.error).toBeTruthy()
    expect(clients.size).toBe(0)
  })

  it('slug duplicado (ja existente) e rejeitado, sem criar um segundo cliente', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    clients.set('client-existente', {
      id: 'client-existente',
      name: 'Ja Existe',
      slug: 'ja-existe',
      organizationId: 'org-a',
      enrollmentKeyHash: 'hash',
      activeProvisioningKeyEnc: null,
    })

    const result = await createClientAction(initialState, buildFormData({ name: 'Outro Nome', slug: 'ja-existe' }))

    expect(result.error).toBeTruthy()
    expect(result.package).toBeNull()
    expect(clients.size).toBe(1)
  })

  it('slug omitido e derivado do nome (slugify), quando valido', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')

    const result = await createClientAction(initialState, buildFormData({ name: 'Café & Cia' }))

    expect(result.error).toBeNull()
    expect(result.package?.clientSlug).toBe('cafe-cia')
  })
})

describe('createClientAction — enrollmentKeyHash gravado como hash, nunca em claro', () => {
  it('o valor persistido em Client.enrollmentKeyHash e diferente da enrollmentKey em claro devolvida ao chamador', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }

    const result = await createClientAction(initialState, buildFormData({ name: 'Cliente Seguro' }))

    expect(result.error).toBeNull()
    const plaintext = result.package?.enrollmentKey
    expect(plaintext).toBeTruthy()

    const persisted = [...clients.values()][0]
    expect(persisted?.enrollmentKeyHash).toBeTruthy()
    expect(persisted?.enrollmentKeyHash).not.toBe(plaintext)
    // enrollmentKeyHash e o hash SHA-256 (hex, 64 chars) de generateEnrollmentKey(),
    // nao uma copia disfarçada da chave em claro.
    expect(persisted?.enrollmentKeyHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('createClientAction — resolucao de organizationId por ator (RN015)', () => {
  it('ORG_ADMIN sempre cria dentro da PROPRIA organizacao, mesmo que o form nao envie organizationId (o form nem tem esse campo)', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'admin-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    await createClientAction(initialState, buildFormData({ name: 'Cliente da Org A' }))

    const created = [...clients.values()][0]
    expect(created?.organizationId).toBe('org-a')
  })

  it('PLATFORM_ADMIN sem organizationId proprio cai na organizacao padrao (ensureDefaultOrganization)', async () => {
    seedOrganization({ id: 'org-default', name: 'Organização Padrão', slug: 'default' })
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }

    await createClientAction(initialState, buildFormData({ name: 'Cliente Sem Org' }))

    const created = [...clients.values()][0]
    expect(created?.organizationId).toBe('org-default')
  })
})

describe('createClientAction — AuditLog na criacao (gap confirmado, nao presumido)', () => {
  it('DOCUMENTA que a criacao de cliente NAO grava AuditLog hoje — diferente de rotateEnrollmentKeyAction/revokeAgentAuthAction, que gravam', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }

    const result = await createClientAction(initialState, buildFormData({ name: 'Cliente Sem Auditoria' }))

    expect(result.error).toBeNull()
    // Leitura do codigo (app/admin/clients/actions.ts) confirma que a transacao
    // de createClientAction so chama tx.client.create + persistActiveProvisioningKey,
    // nunca recordAuditLog — ao contrario de rotateEnrollmentKeyAction/
    // revokeAgentAuthAction no mesmo arquivo. Este teste documenta o comportamento
    // ATUAL (gap real, ja reportado ao usuario), nao um criterio de aceite desta
    // sprint — se a gravacao for adicionada depois, este teste deve ser atualizado
    // junto, nao silenciosamente quebrado.
    expect(auditLogs).toHaveLength(0)
  })
})
