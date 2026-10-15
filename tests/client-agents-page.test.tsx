// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as React from 'react'
import { render, screen, within } from '@testing-library/react'

// Sprint A3, itens 1 e 4 (RF029, RNF004, RN015). /admin/clients/[id]/agents
// carrega o Client por id e aplica canManageTenant(user, client). Inexistente,
// outra organizacao, ORG_OPERATOR e CLIENT_VIEWER recebem o MESMO notFound()
// (sem oraculo de existencia). O proxy.ts ja barra operador e viewer em
// /admin/clients/*; este teste chama a pagina diretamente, que e a segunda
// camada (divergencia 4 do plano).

type FakeClient = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }
type FakeAgent = {
  id: string
  clientId: string
  name: string
  isActive: boolean
  createdAt: Date
  revokedAt: Date | null
  device: null | { hostname: string; agentVersion: string | null; updatedAt: Date; logs: Array<{ coletadoEm: Date }> }
}

const { clients, agents, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const agents: FakeAgent[] = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const client = clients.get(where.id)
        return client ? { ...client } : null
      }),
    },
    agentAuth: {
      findMany: vi.fn(async ({ where }: { where: { clientId: string } }) =>
        agents
          .filter((agent) => agent.clientId === where.clientId)
          .map(({ clientId: _clientId, ...agent }) => agent)
      ),
    },
  }
  return { clients, agents, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/components/sidebar', () => ({
  Sidebar: () => null,
  Header: () => null,
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const PLATFORM_ADMIN = { id: 'u-platform', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }
const ORG_ADMIN_A = { id: 'u-org-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
const ORG_ADMIN_B = { id: 'u-org-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }
const ORG_OPERATOR_A = { id: 'u-op-a', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }
const CLIENT_VIEWER_A = {
  id: 'u-viewer-a',
  email: 'portal@org-a.local',
  role: 'CLIENT_VIEWER',
  organizationId: 'org-a',
  clientId: 'client-a',
}

const NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404'

async function callPage(id: string) {
  const { default: ClientAgentsPage } = await import('@/app/admin/clients/[id]/agents/page')
  return ClientAgentsPage({ params: Promise.resolve({ id }) })
}

/** Captura o digest lancado por next/navigation.notFound(), mesmo helper de tests/tenant-context.test.ts. */
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

function seedClient(overrides: Partial<FakeClient> & { id: string }) {
  const client: FakeClient = {
    name: 'Teste A0 Rotação',
    slug: 'teste-a0-rotacao',
    organizationId: 'org-a',
    isActive: true,
    ...overrides,
  }
  clients.set(client.id, client)
  return client
}

function seedAgent(overrides: Partial<FakeAgent> & { id: string }) {
  agents.push({
    clientId: 'client-a',
    name: `Agente ${overrides.id}`,
    isActive: true,
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    revokedAt: null,
    device: null,
    ...overrides,
  })
}

beforeEach(() => {
  clients.clear()
  agents.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('/admin/clients/[id]/agents — guard (canManageTenant)', () => {
  it('PLATFORM_ADMIN renderiza a pagina de um cliente de qualquer organizacao', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    sessionRef.user = PLATFORM_ADMIN

    const digest = await captureNotFoundDigest(() => callPage('client-a'))

    expect(digest).toBeNull()
  })

  it('ORG_ADMIN da mesma organizacao renderiza', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    sessionRef.user = ORG_ADMIN_A

    const digest = await captureNotFoundDigest(() => callPage('client-a'))

    expect(digest).toBeNull()
  })

  it('ORG_ADMIN de outra organizacao recebe notFound()', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    sessionRef.user = ORG_ADMIN_B

    const digest = await captureNotFoundDigest(() => callPage('client-a'))

    expect(digest).toBe(NOT_FOUND_DIGEST)
    expect(fakePrisma.agentAuth.findMany).not.toHaveBeenCalled()
  })

  it('cliente inexistente recebe o MESMO notFound() de outra organizacao', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })

    sessionRef.user = ORG_ADMIN_A
    const inexistente = await captureNotFoundDigest(() => callPage('client-que-nao-existe'))
    sessionRef.user = ORG_ADMIN_B
    const outraOrg = await captureNotFoundDigest(() => callPage('client-a'))

    expect(inexistente).toBe(NOT_FOUND_DIGEST)
    expect(inexistente).toBe(outraOrg)
  })

  it('ORG_OPERATOR da mesma organizacao recebe notFound()', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    sessionRef.user = ORG_OPERATOR_A

    expect(await captureNotFoundDigest(() => callPage('client-a'))).toBe(NOT_FOUND_DIGEST)
    expect(fakePrisma.agentAuth.findMany).not.toHaveBeenCalled()
  })

  it('CLIENT_VIEWER do proprio cliente recebe notFound()', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    sessionRef.user = CLIENT_VIEWER_A

    expect(await captureNotFoundDigest(() => callPage('client-a'))).toBe(NOT_FOUND_DIGEST)
    expect(fakePrisma.agentAuth.findMany).not.toHaveBeenCalled()
  })

  it('sem sessao recebe notFound()', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    sessionRef.user = null

    expect(await captureNotFoundDigest(() => callPage('client-a'))).toBe(NOT_FOUND_DIGEST)
  })

  it('codigo: usa canManageTenant e nao importa nem copia requireClientsAdminAccess', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'app', 'admin', 'clients', '[id]', 'agents', 'page.tsx'),
      'utf8'
    )
    expect(source).toMatch(/canManageTenant\(\s*user\s*,\s*client\s*\)/)
    expect(source).not.toMatch(/requireClientsAdminAccess/)
  })
})

describe('/admin/clients/[id]/agents — tela (RF029, RN018)', () => {
  async function renderPage(id = 'client-a') {
    const element = (await callPage(id)) as React.ReactElement
    return render(element)
  }

  it('tem exatamente um h1, com o nome do cliente, e link de volta para Clientes', async () => {
    seedClient({ id: 'client-a', name: 'Teste A0 Rotação' })
    sessionRef.user = ORG_ADMIN_A

    const { container } = await renderPage()

    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0]?.textContent).toContain('Teste A0 Rotação')
    const back = screen.getByRole('link', { name: /^Clientes$/ })
    expect(back.getAttribute('href')).toBe('/admin/clients')
  })

  it('mostra cada estado de RN018 numa StatusPill, e "—" na ultima coleta sem Device', async () => {
    seedClient({ id: 'client-a' })
    seedAgent({
      id: 'ativo',
      device: { hostname: 'PC-ATIVO', agentVersion: '1.4.0', updatedAt: new Date('2026-10-14T10:00:00.000Z'), logs: [] },
    })
    seedAgent({ id: 'sem-coleta', device: null })
    seedAgent({ id: 'revogado', isActive: false, revokedAt: new Date('2026-10-10T08:00:00.000Z') })
    sessionRef.user = ORG_ADMIN_A

    await renderPage()

    const table = screen.getByRole('table')
    for (const label of ['Ativo', 'Registrado, sem coleta', 'Revogado']) {
      const pill = within(table).getByText(label, { selector: 'span' })
      expect(pill.className).toMatch(/rounded-full/)
    }
    const rowSemColeta = within(table).getByText('Agente sem-coleta').closest('tr') as HTMLElement
    expect(within(rowSemColeta).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('cliente desativado: agente ativo aparece como "Bloqueado pelo cliente"', async () => {
    seedClient({ id: 'client-a', isActive: false })
    seedAgent({
      id: 'ativo',
      device: { hostname: 'PC-ATIVO', agentVersion: '1.4.0', updatedAt: new Date(), logs: [] },
    })
    sessionRef.user = ORG_ADMIN_A

    await renderPage()

    expect(within(screen.getByRole('table')).getByText('Bloqueado pelo cliente')).toBeTruthy()
  })

  it('agentAuthId curto em .data-mono, com title do id completo', async () => {
    seedClient({ id: 'client-a' })
    const fullId = 'cmabcdefghijklmnop12345678'
    seedAgent({ id: fullId })
    sessionRef.user = ORG_ADMIN_A

    const { container } = await renderPage()

    const idCell = container.querySelector(`[title="${fullId}"]`) as HTMLElement
    expect(idCell).toBeTruthy()
    expect(idCell.className).toMatch(/data-mono/)
    expect(idCell.textContent).not.toBe(fullId)
    expect(fullId).toContain(idCell.textContent?.replace(/\W/g, '') ?? 'x')
  })

  it('estado vazio explica o motivo e tem link focavel para o pacote de instalacao', async () => {
    seedClient({ id: 'client-a' })
    sessionRef.user = ORG_ADMIN_A

    await renderPage()

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText(/Nenhum agente se registrou com a chave deste cliente/i)).toBeTruthy()
    const link = screen.getByRole('link', { name: /pacote de instalação/i })
    expect(link.getAttribute('href')).toBe('/admin/clients')
    link.focus()
    expect(document.activeElement).toBe(link)
  })

  it('cabecalhos da tabela usam TABLE_HEAD_CLASS, sem font-medium', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'app', 'admin', 'clients', '[id]', 'agents', 'client-agents-panel.tsx'),
      'utf8'
    )
    const ths = source.match(/<th\b[^>]*>/g) ?? []
    expect(ths.length).toBeGreaterThan(0)
    for (const th of ths) {
      expect(th).toMatch(/TABLE_HEAD_CLASS/)
      expect(th).not.toMatch(/font-medium/)
    }
  })
})
