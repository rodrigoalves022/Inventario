import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 13, item 3 — fecha o gap "teste de autenticacao dos 4 papeis"
// pedido pelo usuario. Nao ha ferramenta de E2E de browser neste projeto
// (sem Playwright/Cypress instalado) — "E2E" aqui significa integracao
// Vitest exercitando as funcoes REAIS de lib/permissions.ts,
// lib/tenant-context.ts e lib/portal-context.ts com sessao sintetica, NUNCA
// mockando os proprios guards (regra explicita desde a Sprint 10). Mesmo
// padrao de tests/tenant-context.test.ts e tests/portal-context.test.ts:
// mocka so '@/auth' e '@/lib/prisma'.
//
// proxy.ts roda no Edge/runtime de middleware e nao e importavel direto num
// teste Vitest de Node (usa NextAuth() com config propria) — em vez de
// instanciar um servidor HTTP real, cada teste abaixo comenta a linha exata
// de proxy.ts cuja condicao esta replicando, e chama a MESMA funcao de
// lib/permissions.ts que o proxy chama para decidir o redirect. Os casos
// mais profundos de cada guard isolado (cliente inativo, organizacao
// inativa, sentinela de organizationId nulo, vazamento entre clientes) ja
// tem cobertura dedicada em tests/tenant-context.test.ts,
// tests/portal-context.test.ts e tests/users-page-scope.test.ts — este
// arquivo nao duplica esses casos, monta o cenario "os 4 papeis lado a lado"
// que nenhum arquivo cobria antes.

type FakeClient = {
  id: string
  name: string
  slug: string
  organizationId: string
  isActive: boolean
  organizationActive: boolean
}

const { clients, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      // Usado por lib/tenant-context.ts (requireTenantContext).
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
      // Usado por lib/portal-context.ts (getPortalContext).
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { id: string; isActive: boolean; organization: { is: { isActive: boolean } } }
        }) => {
          const client = clients.get(where.id)
          if (!client) return null
          if (client.isActive !== where.isActive) return null
          if (client.organizationActive !== where.organization.is.isActive) return null
          return { id: client.id, name: client.name, slug: client.slug }
        }
      ),
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

/** Captura o digest lancado por next/navigation.notFound()/redirect(), sem mockar next/navigation
 * — mesmo helper de tests/tenant-context.test.ts e tests/portal-context.test.ts. */
async function captureThrownDigest(fn: () => Promise<unknown>): Promise<string | null> {
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

describe('PLATFORM_ADMIN — acesso liberado a /admin/clients, /users, /security e qualquer /app/[clientSlug]', () => {
  it('canAccessGlobalAdmin(user) === true — mesma condicao que libera /admin/clients, /users e /security no proxy (proxy.ts, isPlatformArea/isAccountArea)', async () => {
    const { canAccessGlobalAdmin, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null })

    expect(canAccessGlobalAdmin(user)).toBe(true)
  })

  it('canPossiblyAccessTenantSlug(user, slug) === true para QUALQUER slug — o portao grosseiro de /app/* no proxy nunca bloqueia o admin da plataforma', async () => {
    const { canPossiblyAccessTenantSlug, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null })

    expect(canPossiblyAccessTenantSlug(user, 'slug-nunca-visto-antes')).toBe(true)
  })

  it('requireTenantContext resolve QUALQUER /app/[clientSlug], mesmo de uma organizacao a qual o admin nao pertence', async () => {
    seedClient({ id: 'client-x', slug: 'cliente-x', organizationId: 'org-x' })
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const tenant = await requireTenantContext('cliente-x')

    expect(tenant).toMatchObject({ slug: 'cliente-x', organizationId: 'org-x' })
  })
})

describe('ORG_ADMIN — acesso a propria organizacao e seus clientes; notFound() ao tentar acessar cliente de outra organizacao', () => {
  it('requireTenantContext resolve um cliente da PROPRIA organizacao, sem lancar', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'admin-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const tenant = await requireTenantContext('cliente-a')

    expect(tenant).toMatchObject({ slug: 'cliente-a', organizationId: 'org-a' })
  })

  it('requireTenantContext rejeita (notFound, 404 — nunca 403) um cliente de OUTRA organizacao', async () => {
    seedClient({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-b' })
    sessionRef.user = { id: 'admin-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const digest = await captureThrownDigest(() => requireTenantContext('cliente-b'))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('permanece bloqueado de /security (area exclusiva da plataforma): canAccessGlobalAdmin false, mas isOrgAdmin true (o que libera /admin/clients e /users)', async () => {
    const { canAccessGlobalAdmin, isOrgAdmin, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'admin-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' })

    // proxy.ts: isPlatformArea usa SO canAccessGlobalAdmin — ORG_ADMIN nunca passa.
    expect(canAccessGlobalAdmin(user)).toBe(false)
    // proxy.ts: isAccountArea (/admin/clients, /users) usa canAccessGlobalAdmin(user) || isOrgAdmin(user) — ORG_ADMIN passa por aqui.
    expect(isOrgAdmin(user)).toBe(true)
  })
})

describe('ORG_OPERATOR — opera dispositivos/patrimonio da propria organizacao; bloqueado das areas de gestao de conta/usuarios', () => {
  const tenant = { id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' }

  it('canOperateTenant === true na propria organizacao (dispara comando remoto, edita patrimonio — RN014)', async () => {
    const { canOperateTenant, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'op-a', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' })

    expect(canOperateTenant(user, tenant)).toBe(true)
  })

  it('canOperateTenant === false numa organizacao alheia (mesmo isolamento de canAccessTenant)', async () => {
    const { canOperateTenant, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'op-b', email: 'operador@org-b.local', role: 'ORG_OPERATOR', organizationId: 'org-b' })

    expect(canOperateTenant(user, tenant)).toBe(false)
  })

  it('bloqueado das areas de gestao de conta/usuarios: nem canAccessGlobalAdmin nem isOrgAdmin — a mesma condicao (OR) que o proxy usa para /admin/clients e /users da false', async () => {
    const { canAccessGlobalAdmin, isOrgAdmin, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'op-a', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' })

    expect(canAccessGlobalAdmin(user) || isOrgAdmin(user)).toBe(false)
  })

  it('canManageTenant === false — nao administra credenciais/alertas/usuarios do proprio tenant, so opera (RN014: canManageAssetRecord delega a canOperateTenant, nao a canManageTenant)', async () => {
    const { canManageTenant, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'op-a', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' })

    expect(canManageTenant(user, tenant)).toBe(false)
  })
})

describe('CLIENT_VIEWER — acesso exclusivo a /portal/* (derivado da sessao); redirecionamento para /dashboard em /app/* e /admin/*', () => {
  it('getPortalContext resolve o proprio cliente A PARTIR DA SESSAO, sem nenhum parametro de URL', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = {
      id: 'viewer-a',
      email: 'portal@cliente-a.local',
      role: 'CLIENT_VIEWER',
      organizationId: 'org-a',
      clientId: 'client-a',
    }
    const { getPortalContext } = await import('@/lib/portal-context')

    const context = await getPortalContext()

    expect(context).toMatchObject({ clientId: 'client-a', clientSlug: 'cliente-a' })
  })

  it('isClientViewer(user) === true — mesma condicao que libera /portal/* no proxy (proxy.ts: !isClientViewer(...) redireciona para /dashboard)', async () => {
    const { isClientViewer, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'viewer-a', email: 'portal@cliente-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a' })

    expect(isClientViewer(user)).toBe(true)
  })

  it('canPossiblyAccessTenantSlug(user, slug) === false para qualquer slug — mesma condicao que faz o proxy redirecionar /app/* para /dashboard', async () => {
    const { canPossiblyAccessTenantSlug, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'viewer-a', email: 'portal@cliente-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a' })

    expect(canPossiblyAccessTenantSlug(user, 'qualquer-slug')).toBe(false)
  })

  it('canAccessGlobalAdmin e isOrgAdmin ambos false — mesma condicao (OR) que faz o proxy redirecionar /admin/clients e /users para /dashboard', async () => {
    const { canAccessGlobalAdmin, isOrgAdmin, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'viewer-a', email: 'portal@cliente-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a' })

    expect(canAccessGlobalAdmin(user) || isOrgAdmin(user)).toBe(false)
  })

  it('canAccessTenant(user, tenant) === false mesmo na propria organizacao — CLIENT_VIEWER nunca acessa /app/[clientSlug], so /portal', async () => {
    const { canAccessTenant, getPermissionUser } = await import('@/lib/permissions')
    const user = getPermissionUser({ id: 'viewer-a', email: 'portal@cliente-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a' })

    expect(canAccessTenant(user, { id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })).toBe(false)
  })

  it('requirePortalContext (usado por toda pagina /portal/*) redireciona para /dashboard quando a sessao nao resolve nenhum contexto valido', async () => {
    // clientId nulo: estado inconsistente mas possivel — resolvePortalContext
    // retorna null, e requirePortalContext chama redirect('/dashboard').
    sessionRef.user = { id: 'viewer-x', email: 'portal-sem-cliente@org-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: null }
    const { requirePortalContext } = await import('@/lib/portal-context')

    const digest = await captureThrownDigest(() => requirePortalContext())

    expect(digest).not.toBeNull()
    expect(digest).toContain('NEXT_REDIRECT')
    expect(digest).toContain('/dashboard')
  })
})
