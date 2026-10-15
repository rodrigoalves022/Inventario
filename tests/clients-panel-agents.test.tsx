// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ClientsPanel } from '@/app/admin/clients/clients-panel'
import type { ProvisioningActionState } from '@/app/admin/clients/types'

// Sprint A3, itens 5, 6 e 10 em /admin/clients:
//   - item 6 (N12/RN020): a coluna "Agentes" mostra so AgentAuth ativos;
//   - item 5: o numero leva a /admin/clients/<id>/agents, e "Abrir painel"
//     continua a unica acao preenchida da linha (hierarquia da A2);
//   - item 10 (N4/RN019, UI): checkbox desmarcado no dialogo de rotacao,
//     com a contagem de ativos; some com zero ativos; vai no FormData so
//     quando marcado.

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

type RotateAction = (state: ProvisioningActionState, payload: FormData) => Promise<ProvisioningActionState>

function buildClient(overrides: Partial<{ id: string; name: string; activeAgentCount: number }> = {}) {
  return {
    id: overrides.id ?? 'client-rot',
    name: overrides.name ?? 'Teste A0 Rotação',
    slug: 'teste-a0-rotacao',
    isActive: true,
    createdAt: '2026-10-01T12:00:00.000Z',
    activeAgentCount: overrides.activeAgentCount ?? 2,
  }
}

let action: ReturnType<typeof vi.fn<RotateAction>>

function renderPanel(clients = [buildClient()]) {
  const props = {
    clients,
    serverUrl: 'https://inventario.example.com',
    rotateEnrollmentKeyAction: action,
  } as unknown as React.ComponentProps<typeof ClientsPanel>
  return render(<ClientsPanel {...props} />)
}

function rowOf(name: string) {
  return screen.getByText(name, { selector: 'td' }).closest('tr') as HTMLElement
}

function openRotateDialog() {
  fireEvent.click(screen.getByRole('button', { name: /Emitir novo pacote/i }))
  return screen.getByRole('alertdialog')
}

beforeEach(() => {
  action = vi.fn<RotateAction>(async () => ({ error: null, message: null, package: null }))
})

describe('ClientsPanel — coluna "Agentes" (RN020/N12)', () => {
  it('cliente com 3 AgentAuth (2 ativos, 1 revogado) mostra 2', () => {
    // O tipo antigo trazia agentCount=3 (com o revogado); a coluna nao o usa mais.
    renderPanel([{ ...buildClient({ activeAgentCount: 2 }), agentCount: 3 } as ReturnType<typeof buildClient>])

    const cells = within(rowOf('Teste A0 Rotação')).getAllByRole('cell')
    expect(cells[1]?.textContent?.trim()).toBe('2')
    expect(cells[1]?.textContent).not.toContain('3')
  })
})

describe('ClientsPanel — link para os agentes do cliente', () => {
  it('cada linha leva a /admin/clients/<id>/agents', () => {
    renderPanel([buildClient({ id: 'c-1', name: 'Alfa' }), buildClient({ id: 'c-2', name: 'Beta', activeAgentCount: 0 })])

    for (const [name, id] of [
      ['Alfa', 'c-1'],
      ['Beta', 'c-2'],
    ]) {
      const links = within(rowOf(name)).getAllByRole('link')
      expect(links.map((link) => link.getAttribute('href'))).toContain(`/admin/clients/${id}/agents`)
    }
  })

  it('"Abrir painel" continua a unica acao com variante preenchida', () => {
    renderPanel()

    const row = rowOf('Teste A0 Rotação')
    const actions = Array.from(row.querySelectorAll<HTMLElement>('[data-slot="button"]'))
    const filled = actions.filter((element) =>
      /(^|\s)bg-(primary|secondary|destructive-solid)(\s|$)/.test(element.className)
    )
    expect(filled).toHaveLength(1)
    expect(filled[0]?.textContent).toMatch(/Abrir painel/)
  })
})

describe('ClientsPanel — revogacao em massa na rotacao (N4/RN019)', () => {
  it('o checkbox aparece desmarcado e diz quantos agentes serao revogados', () => {
    renderPanel([buildClient({ activeAgentCount: 2 })])
    const dialog = openRotateDialog()

    const checkbox = within(dialog).getByRole('checkbox', { name: /Revogar também os 2 agentes ativos/i })
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
  })

  it('singular: com 1 ativo, o rotulo fala de 1 agente', () => {
    renderPanel([buildClient({ activeAgentCount: 1 })])
    const dialog = openRotateDialog()

    expect(within(dialog).getByRole('checkbox', { name: /Revogar também o agente ativo/i })).toBeTruthy()
  })

  it('some quando o cliente tem zero agentes ativos', () => {
    renderPanel([buildClient({ activeAgentCount: 0 })])
    const dialog = openRotateDialog()

    expect(within(dialog).queryByRole('checkbox')).toBeNull()
  })

  it('desmarcado: o FormData NAO leva o campo', async () => {
    renderPanel([buildClient({ activeAgentCount: 2 })])
    const dialog = openRotateDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: /^Confirmar$/ }))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action.mock.calls[0]?.[1].has('revokeActiveAgents')).toBe(false)
  })

  it('marcado: o FormData leva revokeActiveAgents=true e o dialogo explica a consequencia', async () => {
    renderPanel([buildClient({ activeAgentCount: 2 })])
    const dialog = openRotateDialog()

    const checkbox = within(dialog).getByRole('checkbox', { name: /Revogar também os 2 agentes ativos/i })
    fireEvent.click(checkbox)
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
    expect(dialog.textContent).toMatch(/param de enviar dados/i)
    expect(dialog.textContent).toMatch(/não pode ser desfeita/i)

    fireEvent.click(within(dialog).getByRole('button', { name: /^Confirmar$/ }))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(action.mock.calls[0]?.[1].get('revokeActiveAgents')).toBe('true')
  })

  it('reabrir o dialogo volta o checkbox para desmarcado', async () => {
    renderPanel([buildClient({ activeAgentCount: 2 })])
    let dialog = openRotateDialog()
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    dialog = openRotateDialog()

    expect(within(dialog).getByRole('checkbox').getAttribute('aria-checked')).toBe('false')
  })
})
