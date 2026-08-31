import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 5 — Consolidacao de Rotas. `/tenant/[clientSlug]/*` virou
// `/app/[clientSlug]/*` e `/clients` virou `/admin/clients`. Este arquivo
// prova, sob a estrutura nova, os 4 pontos exigidos pelo criterio de aceite
// do item 4: (1) rotas novas respondem certo por papel, (2) isolamento
// multi-tenant continua valendo, (3) `/admin/clients` guarda pelos mesmos
// papeis de antes, (4) redirect 308 das URLs antigas preserva sub-caminho e
// querystring.

// `proxy.ts` monta `NextAuth(authConfig)` so para obter o wrapper que injeta
// `req.auth` a partir da sessao real (cookie/JWT). Mockar `next-auth` para
// que o wrapper apenas repasse o handler puro permite chamar a logica de
// `proxy.ts` diretamente com um req fake, sem servidor HTTP nem banco —
// mesmo espirito de isolamento dos outros testes desta suite.
vi.mock('next-auth', () => ({
  default: () => ({
    auth: (handler: (req: FakeAuthRequest) => unknown) => handler,
  }),
}))

type FakeSessionUser = {
  email?: string | null
  role?: string | null
  organizationId?: string | null
  clientId?: string | null
  clientSlug?: string | null
}

type FakeAuthRequest = {
  nextUrl: URL
  auth: { user: FakeSessionUser } | null
}

const ORIGIN = 'https://inventario.example.com'

function makeRequest(pathname: string, opts: { search?: string; user?: FakeSessionUser | null } = {}): FakeAuthRequest {
  const url = new URL(`${ORIGIN}${pathname}${opts.search ?? ''}`)
  return {
    nextUrl: url,
    auth: opts.user ? { user: opts.user } : null,
  }
}

// `proxy.ts` e tipado contra a assinatura REAL de `auth(handler)` do
// next-auth (2 parametros — req e um contexto de rota que esta suite nunca
// usa), mesmo com o modulo mockado em runtime. O cast aqui reflete que, sob
// o mock acima, o handler exportado e chamavel so com o req fake.
type ProxyHandler = (req: FakeAuthRequest) => Response | Promise<Response>

async function callProxy(req: FakeAuthRequest): Promise<Response> {
  const { default: proxy } = await import('@/proxy')
  return (proxy as unknown as ProxyHandler)(req)
}

const PLATFORM_ADMIN: FakeSessionUser = { email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null, clientId: null, clientSlug: null }
const ORG_ADMIN: FakeSessionUser = { email: 'admin@core-ti-expert.local', role: 'ORG_ADMIN', organizationId: 'org-a', clientId: null, clientSlug: null }
const ORG_ADMIN_SEM_ORG: FakeSessionUser = { email: 'admin@sem-org.local', role: 'ORG_ADMIN', organizationId: null, clientId: null, clientSlug: null }
const ORG_OPERATOR: FakeSessionUser = { email: 'operador@core-ti-expert.local', role: 'ORG_OPERATOR', organizationId: 'org-a', clientId: null, clientSlug: null }
const CLIENT_VIEWER: FakeSessionUser = { email: 'portal@core-ti-expert.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a', clientSlug: 'cliente-a' }

describe('proxy — redirect 308 das rotas antigas para as novas', () => {
  it('/tenant/[slug]/computers redireciona 308 para /app/[slug]/computers, preservando querystring', async () => {
    const res = await callProxy(
      makeRequest('/tenant/cliente-a/computers', { search: '?status=online&pagina=2', user: ORG_ADMIN })
    )

    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/app/cliente-a/computers?status=online&pagina=2`)
  })

  it('/tenant/[slug]/alerts redireciona 308 para /app/[slug]/alerts', async () => {
    const res = await callProxy(makeRequest('/tenant/cliente-a/alerts', { user: ORG_ADMIN }))

    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/app/cliente-a/alerts`)
  })

  it('/tenant sozinho (sem sub-caminho) redireciona 308 para /app', async () => {
    const res = await callProxy(makeRequest('/tenant', { user: ORG_ADMIN }))

    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/app`)
  })

  it('redireciona mesmo sem sessao — a URL antiga nao expoe se o recurso existe, so redireciona', async () => {
    const res = await callProxy(makeRequest('/tenant/cliente-a/computers', { user: null }))

    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/app/cliente-a/computers`)
  })

  it('/clients redireciona 308 para /admin/clients, preservando querystring', async () => {
    const res = await callProxy(makeRequest('/clients', { search: '?filtro=ativos', user: PLATFORM_ADMIN }))

    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/admin/clients?filtro=ativos`)
  })

  it('/clients/novo redireciona 308 para /admin/clients/novo', async () => {
    const res = await callProxy(makeRequest('/clients/novo', { user: PLATFORM_ADMIN }))

    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/admin/clients/novo`)
  })

  it('/api/clients/* NAO e redirecionado — fora do escopo do rename (item 2 preserva a API intacta)', async () => {
    const res = await callProxy(makeRequest('/api/clients/client-a/credentials', { user: PLATFORM_ADMIN }))

    expect(res.status).not.toBe(308)
    expect(res.headers.get('location')).toBeNull()
  })
})

describe('proxy — portao grosseiro de /app/[clientSlug] (canPossiblyAccessTenantSlug)', () => {
  it('usuario nao autenticado e barrado antes mesmo do portao de tenant (vai para /login)', async () => {
    const res = await callProxy(makeRequest('/app/cliente-a', { user: null }))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login`)
  })

  it('PLATFORM_ADMIN acessa qualquer slug', async () => {
    const res = await callProxy(makeRequest('/app/cliente-a', { user: PLATFORM_ADMIN }))

    expect(res.headers.get('location')).toBeNull()
  })

  it('ORG_ADMIN/ORG_OPERATOR com organizationId passam pelo portao grosseiro', async () => {
    const resAdmin = await callProxy(makeRequest('/app/cliente-a', { user: ORG_ADMIN }))
    const resOperator = await callProxy(makeRequest('/app/cliente-a', { user: ORG_OPERATOR }))

    expect(resAdmin.headers.get('location')).toBeNull()
    expect(resOperator.headers.get('location')).toBeNull()
  })

  it('ORG_ADMIN sem organizationId e barrado (redireciona para /dashboard)', async () => {
    const res = await callProxy(makeRequest('/app/cliente-a', { user: ORG_ADMIN_SEM_ORG }))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/dashboard`)
  })

  it('CLIENT_VIEWER nunca acessa /app/[slug] — usa /portal', async () => {
    const res = await callProxy(makeRequest('/app/cliente-a', { user: CLIENT_VIEWER }))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/dashboard`)
  })
})

describe('proxy — guard de /admin/clients (isAccountArea)', () => {
  it('PLATFORM_ADMIN e ORG_ADMIN acessam /admin/clients', async () => {
    const resPlatform = await callProxy(makeRequest('/admin/clients', { user: PLATFORM_ADMIN }))
    const resOrgAdmin = await callProxy(makeRequest('/admin/clients', { user: ORG_ADMIN }))

    expect(resPlatform.headers.get('location')).toBeNull()
    expect(resOrgAdmin.headers.get('location')).toBeNull()
  })

  it('ORG_OPERATOR e CLIENT_VIEWER sao barrados de /admin/clients (redireciona para /dashboard)', async () => {
    const resOperator = await callProxy(makeRequest('/admin/clients', { user: ORG_OPERATOR }))
    const resViewer = await callProxy(makeRequest('/admin/clients', { user: CLIENT_VIEWER }))

    expect(resOperator.status).toBe(307)
    expect(resOperator.headers.get('location')).toBe(`${ORIGIN}/dashboard`)
    expect(resViewer.status).toBe(307)
    expect(resViewer.headers.get('location')).toBe(`${ORIGIN}/dashboard`)
  })

  it('/api/clients continua guardado pelo mesmo bloco (ORG_OPERATOR barrado, PLATFORM_ADMIN passa)', async () => {
    const resOperator = await callProxy(makeRequest('/api/clients/client-a/credentials', { user: ORG_OPERATOR }))
    const resPlatform = await callProxy(makeRequest('/api/clients/client-a/credentials', { user: PLATFORM_ADMIN }))

    expect(resOperator.status).toBe(307)
    expect(resOperator.headers.get('location')).toBe(`${ORIGIN}/dashboard`)
    expect(resPlatform.headers.get('location')).toBeNull()
  })
})

// requireTenantContext (lib/tenant-context.ts) nao depende do prefixo de URL
// — recebe so o clientSlug — mas e o ponto que de fato decide isolamento
// entre organizacoes (o portao do proxy acima e so grosseiro). Prova aqui,
// sob a estrutura de rotas nova desta sprint, que uma outra organizacao
// continua sem acesso: mesmo padrao de mock de tests/tenant-context.test.ts.
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

beforeEach(() => {
  clients.clear()
  sessionRef.user = null
  vi.clearAllMocks()
  vi.resetModules()
})

describe('requireTenantContext — isolamento multi-tenant mantido sob /app/[clientSlug]', () => {
  it('ORG_ADMIN de outra organizacao e barrado (404) ao tentar o slug de uma organizacao diferente', async () => {
    clients.set('client-b', { id: 'client-b', name: 'Cliente B', slug: 'cliente-b', organizationId: 'org-b', isActive: true, organizationActive: true })
    sessionRef.user = { id: 'user-a', email: 'admin@core-ti-expert.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    await expect(requireTenantContext('cliente-b')).rejects.toMatchObject({ digest: expect.stringContaining('404') })
  })

  it('ORG_OPERATOR de outra organizacao e barrado (404) ao tentar o slug de uma organizacao diferente', async () => {
    clients.set('client-b', { id: 'client-b', name: 'Cliente B', slug: 'cliente-b', organizationId: 'org-b', isActive: true, organizationActive: true })
    sessionRef.user = { id: 'user-a', email: 'operador@core-ti-expert.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    await expect(requireTenantContext('cliente-b')).rejects.toMatchObject({ digest: expect.stringContaining('404') })
  })

  it('ORG_ADMIN da PROPRIA organizacao continua acessando o tenant normalmente', async () => {
    clients.set('client-a', { id: 'client-a', name: 'Cliente A', slug: 'cliente-a', organizationId: 'org-a', isActive: true, organizationActive: true })
    sessionRef.user = { id: 'user-a', email: 'admin@core-ti-expert.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { requireTenantContext } = await import('@/lib/tenant-context')

    const tenant = await requireTenantContext('cliente-a')

    expect(tenant).toMatchObject({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
  })
})
