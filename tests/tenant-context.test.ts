import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canAccessTenant, type TenantRef } from '@/lib/permissions'

// Sprint 08, item 2. `requireTenantContext` (lib/tenant-context.ts) e o
// chokepoint usado por toda pagina sob /app/[clientSlug]/*. Ate esta
// sprint so era exercitado indiretamente via 3 rotas/actions especificas —
// nenhum teste chamava a funcao diretamente para provar que os 3 casos de
// falha (slug inexistente, slug de outra organizacao, sem sessao) resultam
// no MESMO notFound() (404), indistinguivel entre si.

type FakeClient = {
  id: string
  name: string
  slug: string
  organizationId: string
  isActive: boolean
  organizationActive: boolean
}

// vi.mock(...) e hoisted para o topo do arquivo pelo Vitest, antes de
// qualquer import estatico — mesmo padrao de tests/rotate-enrollment-key.test.ts
// e tests/revoke-agent-auth.test.ts.
const { clients, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
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
          organization: { isActive: client.organizationActive },
        }
      }),
    },
  }

  return { clients, sessionRef, fakePrisma }
})

vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = {
    name: 'Cliente',
    organizationId: 'org-a',
    isActive: true,
    organizationActive: true,
    ...overrides,
  }
  clients.set(client.id, client)
  return client
}

/** Captura o digest lancado por next/navigation.notFound() sem depender de imports internos do Next. */
async function captureNotFoundDigest(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      return String((error as { digest: unknown }).digest)
    }
    throw error
  }
}

const NOT_FOUND_DIGEST_PREFIX = 'NEXT_HTTP_ERROR_FALLBACK;404'

beforeEach(() => {
  clients.clear()
  sessionRef.user = null
  vi.clearAllMocks()
  vi.resetModules()
})

describe('requireTenantContext — 404 uniforme, sem oraculo de existencia', () => {
  it('clientSlug inexistente resulta em notFound() (404)', async () => {
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const digest = await captureNotFoundDigest(() => requireTenantContext('slug-inexistente'))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('clientSlug de OUTRA organizacao resulta no MESMO notFound() (404)', async () => {
    seedClient({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-b' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const digest = await captureNotFoundDigest(() => requireTenantContext('cliente-b'))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('sem sessao valida resulta no MESMO notFound() (404)', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = null
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const digest = await captureNotFoundDigest(() => requireTenantContext('cliente-a'))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('os 3 casos de falha sao indistinguiveis entre si (mesmo digest, nunca 403)', async () => {
    seedClient({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-b' })
    const { requireTenantContext } = await import('@/lib/tenant-context')

    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const inexistente = await captureNotFoundDigest(() => requireTenantContext('slug-que-nao-existe'))
    const outraOrg = await captureNotFoundDigest(() => requireTenantContext('cliente-b'))

    sessionRef.user = null
    const semSessao = await captureNotFoundDigest(() => requireTenantContext('cliente-b'))

    expect(inexistente).toBe(outraOrg)
    expect(outraOrg).toBe(semSessao)
    expect(inexistente).not.toBeNull()
  })

  it('cliente inativo resulta em notFound() (404), tratado como "nao encontrado"', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a', isActive: false })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const digest = await captureNotFoundDigest(() => requireTenantContext('cliente-a'))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('organizacao inativa resulta em notFound() (404), tratado como "nao encontrado"', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a', organizationActive: false })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const digest = await captureNotFoundDigest(() => requireTenantContext('cliente-a'))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('caminho positivo: slug existente + sessao com acesso retorna o TenantContext, sem lancar', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const tenant = await requireTenantContext('cliente-a')

    expect(tenant).toMatchObject({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
  })
})

describe('canAccessTenant — guard puro, sem notFound() nem banco', () => {
  const tenant: TenantRef = { id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' }

  it('PLATFORM_ADMIN sempre tem acesso, independente de organizationId', () => {
    expect(canAccessTenant({ id: 'u', email: null, role: 'PLATFORM_ADMIN', organizationId: null, clientId: null, clientSlug: null }, tenant)).toBe(true)
    expect(canAccessTenant({ id: 'u', email: null, role: 'PLATFORM_ADMIN', organizationId: 'org-b', clientId: null, clientSlug: null }, tenant)).toBe(true)
  })

  it('ORG_ADMIN so tem acesso quando organizationId bate com o tenant', () => {
    expect(canAccessTenant({ id: 'u', email: null, role: 'ORG_ADMIN', organizationId: 'org-a', clientId: null, clientSlug: null }, tenant)).toBe(true)
    expect(canAccessTenant({ id: 'u', email: null, role: 'ORG_ADMIN', organizationId: 'org-b', clientId: null, clientSlug: null }, tenant)).toBe(false)
  })

  it('ORG_OPERATOR so tem acesso quando organizationId bate com o tenant', () => {
    expect(canAccessTenant({ id: 'u', email: null, role: 'ORG_OPERATOR', organizationId: 'org-a', clientId: null, clientSlug: null }, tenant)).toBe(true)
    expect(canAccessTenant({ id: 'u', email: null, role: 'ORG_OPERATOR', organizationId: 'org-b', clientId: null, clientSlug: null }, tenant)).toBe(false)
  })

  it('CLIENT_VIEWER nunca tem acesso a /tenant, mesmo na propria organizacao — usa /portal', () => {
    expect(canAccessTenant({ id: 'u', email: null, role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a', clientSlug: 'cliente-a' }, tenant)).toBe(false)
  })

  it('role null (sessao invalida/fail-closed) nunca tem acesso', () => {
    expect(canAccessTenant({ id: 'u', email: null, role: null, organizationId: 'org-a', clientId: null, clientSlug: null }, tenant)).toBe(false)
    expect(canAccessTenant(null, tenant)).toBe(false)
    expect(canAccessTenant(undefined, tenant)).toBe(false)
  })
})
