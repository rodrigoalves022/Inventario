// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ClientsPanel } from '@/app/admin/clients/clients-panel'
import type { ProvisioningActionState } from '@/app/admin/clients/types'

// Sprint A1, F1. A rotacao da chave de instalacao ("Emitir novo pacote") era
// disparada sem confirmacao e o resultado da Server Action era descartado
// (`const [, rotateAction] = useActionState(...)`): o hash mudava e a tela nao
// mostrava nada, nem sucesso nem erro. Estes testes travam:
//   - o AlertDialog de confirmacao ANTES de chamar a action;
//   - a contagem de maquinas que continuam funcionando (AgentAuth ativos);
//   - o painel com o pacote novo em sucesso e a mensagem em erro.

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

type RotateAction = (state: ProvisioningActionState, payload: FormData) => Promise<ProvisioningActionState>

function buildClient(overrides: Partial<{ activeAgentCount: number; agentCount: number }> = {}) {
  return {
    id: 'client-rot',
    name: 'Teste A0 Rotação',
    slug: 'teste-a0-rotacao',
    isActive: true,
    createdAt: '2026-10-01T12:00:00.000Z',
    agentCount: overrides.agentCount ?? 3,
    activeAgentCount: overrides.activeAgentCount ?? 2,
  }
}

const successState: ProvisioningActionState = {
  error: null,
  message: 'Chave de instalação rotacionada. Revise os instaladores antigos.',
  package: {
    clientId: 'client-rot',
    clientName: 'Teste A0 Rotação',
    clientSlug: 'teste-a0-rotacao',
    enrollmentKey: 'CHAVE-NOVA-123',
    bootstrapUrl: 'https://inventario.example.com/api/agent/bootstrap?client=teste-a0-rotacao',
    bootstrapCommand: 'powershell -c "bootstrap"',
    installCommand: 'install.exe --key CHAVE-NOVA-123',
  },
}

function renderPanel(action: RotateAction, client = buildClient()) {
  // `createClientAction` deixa de ser prop do painel (F2). Passado como
  // spread para o teste nao depender do tipo antigo nem do novo.
  const props = {
    clients: [client],
    serverUrl: 'https://inventario.example.com',
    rotateEnrollmentKeyAction: action,
  } as unknown as React.ComponentProps<typeof ClientsPanel>
  return render(<ClientsPanel {...props} />)
}

function openRotateDialog() {
  fireEvent.click(screen.getByRole('button', { name: /Emitir novo pacote/i }))
  return screen.getByRole('alertdialog')
}

let action: ReturnType<typeof vi.fn<RotateAction>>

beforeEach(() => {
  action = vi.fn<RotateAction>(async () => successState)
})

describe('ClientsPanel — confirmacao antes de rotacionar (F1)', () => {
  it('clicar em "Emitir novo pacote" abre um AlertDialog e NAO chama a action', () => {
    renderPanel(action)

    const dialog = openRotateDialog()

    expect(dialog).toBeTruthy()
    expect(action).not.toHaveBeenCalled()
  })

  it('"Cancelar" fecha o dialogo sem chamar a action', async () => {
    renderPanel(action)
    const dialog = openRotateDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: /Cancelar/i }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(action).not.toHaveBeenCalled()
  })

  it('"Confirmar" chama a action uma vez, com o clientId e o serverUrl do cliente', async () => {
    renderPanel(action)
    const dialog = openRotateDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: /^Confirmar$/i }))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const formData = action.mock.calls[0]?.[1]
    expect(formData).toBeInstanceOf(FormData)
    expect(formData?.get('clientId')).toBe('client-rot')
    expect(formData?.get('serverUrl')).toBe('https://inventario.example.com')
  })
})

describe('ClientsPanel — contagem de maquinas no dialogo (F1)', () => {
  it('2 credenciais ativas (e 1 revogada) mostram "2 máquinas" que continuam funcionando', () => {
    // agentCount (coluna "Agentes") conta as 3, incluindo a revogada; o
    // dialogo usa a contagem propria de AgentAuth ativos.
    renderPanel(action, buildClient({ agentCount: 3, activeAgentCount: 2 }))
    const dialog = openRotateDialog()

    expect(dialog.textContent).toMatch(/2 máquinas já registradas continuam funcionando/)
    expect(dialog.textContent).not.toMatch(/3 máquinas/)
  })

  it('singular: 1 credencial ativa mostra "1 máquina" (sem plural)', () => {
    renderPanel(action, buildClient({ agentCount: 1, activeAgentCount: 1 }))
    const dialog = openRotateDialog()

    expect(dialog.textContent).toMatch(/1 máquina já registrada continua funcionando/)
    expect(dialog.textContent).not.toMatch(/1 máquinas/)
  })

  it('zero: sem credencial ativa, informa que nenhuma máquina está registrada', () => {
    renderPanel(action, buildClient({ agentCount: 1, activeAgentCount: 0 }))
    const dialog = openRotateDialog()

    expect(dialog.textContent).toMatch(/Nenhuma máquina/)
    expect(dialog.textContent).not.toMatch(/0 máquina/)
  })

  it('avisa que instaladores, comandos e pacotes antigos param de funcionar', () => {
    renderPanel(action)
    const dialog = openRotateDialog()

    expect(dialog.textContent).toMatch(/instaladores, comandos e pacotes/i)
    expect(dialog.textContent).toMatch(/param de funcionar/i)
  })
})

describe('ClientsPanel — resultado da rotacao (F1)', () => {
  it('sucesso: exibe o pacote com a chave NOVA e o aviso de revisar os instaladores antigos', async () => {
    renderPanel(action)
    fireEvent.click(within(openRotateDialog()).getByRole('button', { name: /^Confirmar$/i }))

    expect(await screen.findByText('CHAVE-NOVA-123')).toBeTruthy()
    // Restrito ao painel visivel: o mesmo texto tambem vai para a regiao role="status".
    expect(within(screen.getByTestId('rotation-result')).getByText(/Revise os instaladores antigos/i)).toBeTruthy()
  })

  it('erro: exibe a mensagem de erro devolvida pela action', async () => {
    action = vi.fn<RotateAction>(async () => ({
      error: 'Cliente não encontrado.',
      message: null,
      package: null,
    }))
    renderPanel(action)
    fireEvent.click(within(openRotateDialog()).getByRole('button', { name: /^Confirmar$/i }))

    expect(await screen.findByText('Cliente não encontrado.')).toBeTruthy()
  })

  it('o botao de dispensar ("X") remove o painel de resultado', async () => {
    renderPanel(action)
    fireEvent.click(within(openRotateDialog()).getByRole('button', { name: /^Confirmar$/i }))
    await screen.findByText('CHAVE-NOVA-123')

    fireEvent.click(screen.getByRole('button', { name: /Dispensar/i }))

    await waitFor(() => expect(screen.queryByText('CHAVE-NOVA-123')).toBeNull())
  })
})

// Achados 1 e 2 do visual-qa na verificacao da Sprint A1: ao cancelar, o foco
// caia em <body>; ao confirmar, o pacote novo aparecia sem aviso para leitor
// de tela e com o foco tambem em <body>.
describe('ClientsPanel — foco e anuncio da rotacao (acessibilidade)', () => {
  it('"Cancelar" devolve o foco ao botao "Emitir novo pacote" que abriu o dialogo', async () => {
    renderPanel(action)
    const trigger = screen.getByRole('button', { name: /Emitir novo pacote/i })
    trigger.focus()

    const dialog = openRotateDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('depois de confirmar, anuncia o pacote novo numa regiao role="status" e leva o foco ao resultado', async () => {
    renderPanel(action)

    const dialog = openRotateDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Novo pacote emitido para Teste A0 Rotação/)
    )
    const result = screen.getByTestId('rotation-result')
    await waitFor(() => expect(document.activeElement).toBe(result))
  })

  it('depois de uma rotacao com erro, anuncia o erro na mesma regiao role="status"', async () => {
    action = vi.fn<RotateAction>(async () => ({
      error: 'Cliente não encontrado.',
      message: null,
      package: null,
    }))
    renderPanel(action)

    const dialog = openRotateDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Falha ao emitir novo pacote: Cliente não encontrado\./)
    )
  })
})
