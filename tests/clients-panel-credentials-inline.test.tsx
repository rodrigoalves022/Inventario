// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ClientsPanel } from '@/app/admin/clients/clients-panel'
import type { ProvisioningActionState } from '@/app/admin/clients/types'

// Sprint A2, itens 3, 7 e 8 (E2, E6 e E7 do relatorio A0).
// - E6, decisao 1 = (C): "Ver credenciais" deixa de abrir um Dialog. As
//   credenciais aparecem como Panel inline, no MESMO espaco de resultado da
//   rotacao (A1), com "Dispensar" e foco programatico. Um resultado por vez: a
//   acao mais recente substitui a anterior. RNF009: uma requisicao (e portanto
//   um `credentials.view`) por clique, nada buscado antes do clique.
// - E7, decisao 2 = (a): status em StatusPill ("Ativo"/"Inativo"); "Abrir
//   painel" e a unica acao com preenchimento; "Emitir novo pacote" fica na
//   linha em ghost, sem o icone Terminal; "Confirmar" em estilo destrutivo.
// - Estado vazio explica o porque e oferece o link para /admin/clients/novo.

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

type RotateAction = (state: ProvisioningActionState, payload: FormData) => Promise<ProvisioningActionState>

const SERVER_URL = 'https://inventario.example.com'

function buildClient(overrides: Partial<{ id: string; name: string; slug: string; isActive: boolean }> = {}) {
  return {
    id: overrides.id ?? 'client-rot',
    name: overrides.name ?? 'Teste A0 Rotação',
    slug: overrides.slug ?? 'teste-a0-rotacao',
    isActive: overrides.isActive ?? true,
    createdAt: '2026-10-01T12:00:00.000Z',
    agentCount: 3,
    activeAgentCount: 2,
  }
}

const pkg = {
  clientId: 'client-rot',
  clientName: 'Teste A0 Rotação',
  clientSlug: 'teste-a0-rotacao',
  bootstrapUrl: `${SERVER_URL}/api/agent/bootstrap?client=teste-a0-rotacao`,
  bootstrapCommand: 'powershell -c "bootstrap"',
  installCommand: 'install.exe',
}

const availableBody = {
  status: 'available',
  package: { ...pkg, enrollmentKey: 'CHAVE-ATIVA-999' },
  generatedAt: '2026-10-10T10:00:00.000Z',
}

const rotationSuccess: ProvisioningActionState = {
  error: null,
  message: 'Chave de instalação rotacionada. Revise os instaladores antigos.',
  package: { ...pkg, enrollmentKey: 'CHAVE-NOVA-123' },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>
let action: ReturnType<typeof vi.fn<RotateAction>>

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse(availableBody))
  vi.stubGlobal('fetch', fetchMock)
  action = vi.fn<RotateAction>(async () => rotationSuccess)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPanel(clients = [buildClient()]) {
  return render(<ClientsPanel clients={clients} serverUrl={SERVER_URL} rotateEnrollmentKeyAction={action} />)
}

function credentialRequests() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/credentials'))
}

async function clickViewCredentials(name = /Ver credenciais/i) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

describe('ClientsPanel — credenciais inline (E6, opcao C)', () => {
  it('nada e buscado antes do clique (render e hover)', () => {
    renderPanel()
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Ver credenciais/i }))
    fireEvent.mouseOver(screen.getByRole('button', { name: /Ver credenciais/i }))

    expect(credentialRequests()).toHaveLength(0)
  })

  it('um clique dispara exatamente uma requisicao a /api/clients/<id>/credentials', async () => {
    renderPanel()
    await clickViewCredentials()
    await screen.findByText('CHAVE-ATIVA-999')

    expect(credentialRequests()).toHaveLength(1)
    expect(String(credentialRequests()[0]?.[0])).toMatch(/^\/api\/clients\/client-rot\/credentials/)
  })

  it('nao abre nenhum role="dialog"', async () => {
    renderPanel()
    await clickViewCredentials()
    await screen.findByText('CHAVE-ATIVA-999')

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('loading aparece enquanto a requisicao nao volta', async () => {
    let resolve: (value: Response) => void = () => {}
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (resolve = r)))
    renderPanel()
    await clickViewCredentials()

    expect(within(screen.getByTestId('credentials-result')).getByText(/Carregando credenciais ativas/)).toBeTruthy()

    await act(async () => resolve(jsonResponse(availableBody)))
    expect(await screen.findByText('CHAVE-ATIVA-999')).toBeTruthy()
  })

  it('disponivel: mostra o pacote ativo e leva o foco ao painel', async () => {
    renderPanel()
    await clickViewCredentials()

    expect(await screen.findByText('CHAVE-ATIVA-999')).toBeTruthy()
    const result = screen.getByTestId('credentials-result')
    await waitFor(() => expect(document.activeElement).toBe(result))
    expect(result.textContent).toMatch(/Credenciais ativas/)
    expect(result.textContent).toMatch(/Teste A0 Rotação/)
  })

  it('erro: mostra a mensagem do servidor e leva o foco ao painel', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ error: 'Sem permissão.' }, 403))
    renderPanel()
    await clickViewCredentials()

    expect(await screen.findByText('Sem permissão.')).toBeTruthy()
    const result = screen.getByTestId('credentials-result')
    expect(result.textContent).toMatch(/Falha ao consultar credenciais/)
    await waitFor(() => expect(document.activeElement).toBe(result))
  })

  it('indisponivel: mostra a mensagem de pacote indisponivel', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ status: 'unavailable', reason: 'legacy', message: 'Cliente legado: emita um novo pacote.' })
    )
    renderPanel()
    await clickViewCredentials()

    expect(await screen.findByText('Cliente legado: emita um novo pacote.')).toBeTruthy()
    expect(screen.getByTestId('credentials-result').textContent).toMatch(/Pacote ativo indisponível/)
  })

  it('nenhum card com borda propria dentro do painel de credenciais', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ error: 'Sem permissão.' }, 403))
    renderPanel()
    await clickViewCredentials()
    await screen.findByText('Sem permissão.')

    const result = screen.getByTestId('credentials-result')
    expect(result.querySelector('[data-slot="card"]')).toBeNull()
  })

  it('"Dispensar" remove o conteudo', async () => {
    renderPanel()
    await clickViewCredentials()
    await screen.findByText('CHAVE-ATIVA-999')

    fireEvent.click(within(screen.getByTestId('credentials-result')).getByRole('button', { name: 'Dispensar' }))

    await waitFor(() => expect(screen.queryByText('CHAVE-ATIVA-999')).toBeNull())
    expect(screen.queryByTestId('credentials-result')).toBeNull()
  })

  it('uma rotacao feita depois substitui o painel de credenciais no mesmo espaco', async () => {
    renderPanel()
    await clickViewCredentials()
    await screen.findByText('CHAVE-ATIVA-999')
    const slotParent = screen.getByTestId('credentials-result').parentElement

    fireEvent.click(screen.getByRole('button', { name: /Emitir novo pacote/i }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('CHAVE-NOVA-123')).toBeTruthy()
    expect(screen.queryByText('CHAVE-ATIVA-999')).toBeNull()
    expect(screen.queryByTestId('credentials-result')).toBeNull()
    expect(screen.getByTestId('rotation-result').parentElement).toBe(slotParent)
  })

  it('"Ver credenciais" depois de uma rotacao substitui o resultado da rotacao', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Emitir novo pacote/i }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }))
    await screen.findByText('CHAVE-NOVA-123')

    await clickViewCredentials()

    expect(await screen.findByText('CHAVE-ATIVA-999')).toBeTruthy()
    expect(screen.queryByText('CHAVE-NOVA-123')).toBeNull()
    expect(screen.queryByTestId('rotation-result')).toBeNull()
  })
})

describe('ClientsPanel — status em StatusPill (E7)', () => {
  it('cliente ativo mostra "Ativo" e inativo mostra "Inativo", sem Badge', () => {
    const { container } = renderPanel([
      buildClient({ id: 'a', name: 'Alfa', isActive: true }),
      buildClient({ id: 'b', name: 'Beta', slug: 'beta', isActive: false }),
    ])

    const rows = within(container.querySelector('tbody')!).getAllByRole('row')
    const active = within(rows[0]!).getByText('Ativo')
    const inactive = within(rows[1]!).getByText('Inativo')
    expect(active.className).toMatch(/text-success/)
    expect(active.querySelector('.status-dot')).not.toBeNull()
    expect(inactive.className).toMatch(/text-muted-foreground/)
    expect(container.querySelector('[data-slot="badge"]')).toBeNull()
  })
})

describe('ClientsPanel — hierarquia das acoes por linha (E7, opcao a)', () => {
  it('so "Abrir painel" tem preenchimento; "Ver credenciais" e "Emitir novo pacote" tem menor peso', () => {
    renderPanel()

    const open = screen.getByRole('link', { name: /Abrir painel/i })
    const view = screen.getByRole('button', { name: /Ver credenciais/i })
    const rotate = screen.getByRole('button', { name: /Emitir novo pacote/i })
    const filled = /(^|\s)bg-(primary|secondary)(\s|$)/

    expect(open.className).toMatch(filled)
    expect(view.className).not.toMatch(filled)
    expect(rotate.className).not.toMatch(filled)
    // ghost: sem borda propria e sem icone
    expect(rotate.className).not.toMatch(/(^|\s)border(\s|$)/)
    expect(rotate.querySelector('svg')).toBeNull()
  })

  it('"Confirmar" da rotacao usa o estilo destrutivo, com o mesmo rotulo', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Emitir novo pacote/i }))

    const confirm = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar' })
    expect(confirm.className).toMatch(/bg-destructive-solid/)
    expect(confirm.className).not.toMatch(/(^|\s)bg-primary(\s|$)/)
  })
})

describe('ClientsPanel — tabela com tokens (E2)', () => {
  it('cabecalho usa section-label e nenhum <th> usa font-medium', () => {
    const { container } = renderPanel()

    const headRow = container.querySelector('thead tr')!
    expect(headRow.className).toMatch(/bg-surface-raise/)
    for (const th of Array.from(container.querySelectorAll('th'))) {
      expect(th.className).toMatch(/section-label/)
      expect(th.className).not.toMatch(/font-medium/)
    }
    expect(container.querySelector('[data-slot="card"]')).toBeNull()
  })
})

describe('ClientsPanel — estado vazio (E7)', () => {
  it('explica por que esta vazio e oferece link focavel para /admin/clients/novo, sem caixa com borda', () => {
    const { container } = renderPanel([])

    const link = screen.getByRole('link', { name: /Cadastrar o primeiro cliente/i })
    expect(link.getAttribute('href')).toBe('/admin/clients/novo')
    expect(container.textContent).toMatch(/Nenhum cliente cadastrado/)
    expect(container.querySelector('.border-dashed')).toBeNull()
    expect(container.querySelector('[data-slot="card"]')).toBeNull()
  })
})
