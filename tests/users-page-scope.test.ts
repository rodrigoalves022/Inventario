import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'

// Sprint 10, item 2. `/users` (app/users/page.tsx) e a unica tela de gestao de
// usuarios (RF023) — ate esta sprint nao havia teste algum do escopo por role:
// PLATFORM_ADMIN ve todos, ORG_ADMIN so os da propria organizacao, e o caso
// sentinela (ORG_ADMIN sem organizationId preenchido, estado inconsistente mas
// possivel na coluna String livre) precisa dar ZERO resultados — fail-closed,
// nao um "where: undefined" que devolveria todos os usuarios da plataforma.
//
// Sidebar/Header sao 'use client' com hooks de roteador (usePathname/useRouter)
// que exigem contexto do App Router — fora de escopo deste teste (a logica sob
// teste e a query/guard da propria pagina, nao o chrome de navegacao), entao sao
// substituidos por stubs sincronos simples, permitindo renderToStaticMarkup da
// arvore inteira sem montar um app router de verdade.

type FakeUser = {
  id: string
  name: string | null
  email: string
  role: string
  organizationId: string | null
  isActive: boolean
  createdAt: Date
  organizationName: string | null
  clientName: string | null
}

const { users, sessionRef, fakePrisma, findManyCalls } = vi.hoisted(() => {
  const users: FakeUser[] = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const findManyCalls: unknown[] = []

  const fakePrisma = {
    user: {
      findMany: vi.fn(async (args: { where?: { organizationId: string } }) => {
        findManyCalls.push(args)
        const filtered = args.where
          ? users.filter((u) => u.organizationId === args.where!.organizationId)
          : users
        return filtered.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
          organization: u.organizationName ? { name: u.organizationName } : null,
          client: u.clientName ? { name: u.clientName } : null,
        }))
      }),
    },
  }

  return { users, sessionRef, fakePrisma, findManyCalls }
})

vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/components/sidebar', () => ({
  Sidebar: () => null,
  Header: () => null,
}))

function seedUser(overrides: Partial<FakeUser> & { id: string; email: string; organizationId: string | null }) {
  const user: FakeUser = {
    name: 'Usuario',
    role: 'ORG_OPERATOR',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    organizationName: null,
    clientName: null,
    ...overrides,
  }
  users.push(user)
  return user
}

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
  users.length = 0
  findManyCalls.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
  vi.resetModules()
})

describe('/users — chokepoint de acesso (notFound, nunca 403)', () => {
  it('ORG_OPERATOR recebe notFound() (404), nao 403', async () => {
    const { default: UsersPage } = await import('@/app/users/page')
    sessionRef.user = { id: 'u1', email: 'op@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const digest = await captureNotFoundDigest(() => UsersPage({}))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('CLIENT_VIEWER recebe notFound() (404), nao 403', async () => {
    const { default: UsersPage } = await import('@/app/users/page')
    sessionRef.user = { id: 'u2', email: 'portal@org-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a' }

    const digest = await captureNotFoundDigest(() => UsersPage({}))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })
})

describe('/users — escopo por role da query real de prisma.user.findMany', () => {
  it('PLATFORM_ADMIN ve usuarios de TODAS as organizacoes (where: undefined)', async () => {
    seedUser({ id: 'u-a', email: 'a@org-a.local', organizationId: 'org-a' })
    seedUser({ id: 'u-b', email: 'b@org-b.local', organizationId: 'org-b' })
    const { default: UsersPage } = await import('@/app/users/page')
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }

    const element = await UsersPage({})
    const html = renderToStaticMarkup(element as React.ReactElement)

    expect(findManyCalls[0]).toMatchObject({ where: undefined })
    expect(html).toContain('a@org-a.local')
    expect(html).toContain('b@org-b.local')
  })

  it('ORG_ADMIN ve SOMENTE usuarios da propria organizacao', async () => {
    seedUser({ id: 'u-a', email: 'a@org-a.local', organizationId: 'org-a' })
    seedUser({ id: 'u-b', email: 'b@org-b.local', organizationId: 'org-b' })
    const { default: UsersPage } = await import('@/app/users/page')
    sessionRef.user = { id: 'admin-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const element = await UsersPage({})
    const html = renderToStaticMarkup(element as React.ReactElement)

    expect(findManyCalls[0]).toMatchObject({ where: { organizationId: 'org-a' } })
    expect(html).toContain('a@org-a.local')
    expect(html).not.toContain('b@org-b.local')
  })

  it('SENTINELA: ORG_ADMIN sem organizationId preenchido nao ve usuario NENHUM (fail-closed, nao fail-open)', async () => {
    seedUser({ id: 'u-a', email: 'a@org-a.local', organizationId: 'org-a' })
    seedUser({ id: 'u-b', email: 'b@org-b.local', organizationId: 'org-b' })
    seedUser({ id: 'u-orphan', email: 'orphan@no-org.local', organizationId: null })
    const { default: UsersPage } = await import('@/app/users/page')
    // Estado inconsistente, mas possivel: ORG_ADMIN com organizationId nulo.
    sessionRef.user = { id: 'admin-broken', email: 'broken@inventario.local', role: 'ORG_ADMIN', organizationId: null }

    const element = await UsersPage({})
    const html = renderToStaticMarkup(element as React.ReactElement)

    // O guard usa o sentinela '__sem_organizacao__' (que nenhum registro real
    // tem) em vez de "where: undefined" — por isso o filtro nunca degrada para
    // "ver todo mundo" quando organizationId vem nulo da sessao.
    expect(findManyCalls[0]).toMatchObject({ where: { organizationId: '__sem_organizacao__' } })
    expect(html).not.toContain('a@org-a.local')
    expect(html).not.toContain('b@org-b.local')
    expect(html).not.toContain('orphan@no-org.local')
    expect(html).toContain('Nenhum usuário encontrado.')
  })
})

describe('/users — filtro por KPI (?filter=)', () => {
  function seedMixedRoles() {
    seedUser({ id: 'u-adm', email: 'adm@org-a.local', organizationId: 'org-a', role: 'ORG_ADMIN' })
    seedUser({ id: 'u-op', email: 'op@org-a.local', organizationId: 'org-a', role: 'ORG_OPERATOR' })
    seedUser({ id: 'u-view', email: 'view@org-a.local', organizationId: 'org-a', role: 'CLIENT_VIEWER', isActive: false })
  }

  async function renderWithFilter(filter?: string) {
    const { default: UsersPage } = await import('@/app/users/page')
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }
    const element = await UsersPage({ searchParams: Promise.resolve({ filter }) })
    return renderToStaticMarkup(element as React.ReactElement)
  }

  it('admins mostra so PLATFORM_ADMIN/ORG_ADMIN e oferece "Limpar filtro"', async () => {
    seedMixedRoles()
    const html = await renderWithFilter('admins')

    expect(html).toContain('adm@org-a.local')
    expect(html).not.toContain('op@org-a.local')
    expect(html).not.toContain('view@org-a.local')
    expect(html).toContain('Limpar filtro')
  })

  it('operators mostra ORG_OPERATOR e CLIENT_VIEWER', async () => {
    seedMixedRoles()
    const html = await renderWithFilter('operators')

    expect(html).not.toContain('adm@org-a.local')
    expect(html).toContain('op@org-a.local')
    expect(html).toContain('view@org-a.local')
  })

  it('active esconde contas inativas', async () => {
    seedMixedRoles()
    const html = await renderWithFilter('active')

    expect(html).toContain('adm@org-a.local')
    expect(html).toContain('op@org-a.local')
    expect(html).not.toContain('view@org-a.local')
  })

  it('valor desconhecido cai em "all" e nao mostra "Limpar filtro"', async () => {
    seedMixedRoles()
    const html = await renderWithFilter('qualquer-coisa')

    expect(html).toContain('adm@org-a.local')
    expect(html).toContain('op@org-a.local')
    expect(html).toContain('view@org-a.local')
    expect(html).not.toContain('Limpar filtro')
  })
})
