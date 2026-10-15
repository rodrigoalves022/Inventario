// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ClientAgentsPanel } from '@/app/admin/clients/[id]/agents/client-agents-panel'
import type { ClientAgentRow } from '@/app/admin/clients/queries'
import type { RevokeAgentAuthState } from '@/app/admin/clients/actions'

// Sprint A3, item 7 (RF030). Revogar pela UI reaproveita os padroes da A1/A2
// de app/admin/clients/clients-panel.tsx: AlertDialog com "Confirmar"
// destrutivo, devolucao de foco ao gatilho via onCloseAutoFocus, regiao
// role="status" sempre montada e foco programatico no resultado.

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

type RevokeAction = (state: RevokeAgentAuthState, payload: FormData) => Promise<RevokeAgentAuthState>

function agent(overrides: Partial<ClientAgentRow> & { id: string }): ClientAgentRow {
  return {
    name: `Agente ${overrides.id}`,
    isActive: true,
    createdAt: '2026-10-01T12:00:00.000Z',
    revokedAt: null,
    hasDevice: true,
    hostname: `PC-${overrides.id}`,
    agentVersion: '1.4.0',
    lastCollectionAt: '2026-10-14T10:00:00.000Z',
    ...overrides,
  }
}

let action: ReturnType<typeof vi.fn<RevokeAction>>

function renderPanel(agents: ClientAgentRow[]) {
  return render(
    <ClientAgentsPanel
      client={{ id: 'client-a', name: 'Teste A0 Rotação', isActive: true }}
      agents={agents}
      revokeAgentAuthAction={action}
    />
  )
}

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement
}

function openDialogFor(name: string) {
  fireEvent.click(within(rowOf(name)).getByRole('button', { name: /Revogar/ }))
  return screen.getByRole('alertdialog')
}

beforeEach(() => {
  action = vi.fn<RevokeAction>(async () => ({ error: null, message: 'Credencial de agente revogada.' }))
})

describe('ClientAgentsPanel — botao "Revogar"', () => {
  it('so existe em linhas nao revogadas', () => {
    renderPanel([
      agent({ id: 'ativo' }),
      agent({ id: 'revogado', isActive: false, revokedAt: '2026-10-10T08:00:00.000Z' }),
    ])

    expect(within(rowOf('Agente ativo')).queryByRole('button', { name: /Revogar/ })).toBeTruthy()
    expect(within(rowOf('Agente revogado')).queryByRole('button', { name: /Revogar/ })).toBeNull()
  })

  it('o clique abre um alertdialog e NAO chama a action', () => {
    renderPanel([agent({ id: 'ativo' }), agent({ id: 'outro' })])

    const dialog = openDialogFor('Agente ativo')

    expect(dialog).toBeTruthy()
    expect(action).not.toHaveBeenCalled()
  })

  it('"Cancelar" nao chama a action e devolve o foco ao "Revogar" da linha', async () => {
    renderPanel([agent({ id: 'ativo' }), agent({ id: 'outro' })])
    const trigger = within(rowOf('Agente outro')).getByRole('button', { name: /Revogar/ })
    trigger.focus()

    fireEvent.click(trigger)
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(action).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('"Confirmar" (variante destrutiva) chama a action com o agentAuthId da linha', async () => {
    renderPanel([agent({ id: 'ativo' }), agent({ id: 'alvo-123' })])

    const dialog = openDialogFor('Agente alvo-123')
    const confirm = within(dialog).getByRole('button', { name: /^Confirmar$/ })
    expect(confirm.className).toMatch(/bg-destructive-solid/)
    fireEvent.click(confirm)

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const formData = action.mock.calls[0]?.[1]
    expect(formData).toBeInstanceOf(FormData)
    expect(formData?.get('agentAuthId')).toBe('alvo-123')
  })

  it('o resultado e anunciado em role="status" (sempre montada) e recebe o foco', async () => {
    renderPanel([agent({ id: 'ativo' }), agent({ id: 'alvo' })])
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')

    fireEvent.click(within(openDialogFor('Agente alvo')).getByRole('button', { name: /^Confirmar$/ }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Credencial de agente revogada/))
    expect(screen.getByRole('status').textContent).toMatch(/Agente alvo/)
    const result = screen.getByTestId('revoke-result')
    await waitFor(() => expect(document.activeElement).toBe(result))
  })

  it('erro da action tambem e anunciado em role="status"', async () => {
    action = vi.fn<RevokeAction>(async () => ({ error: 'Credencial de agente não encontrada.', message: null }))
    renderPanel([agent({ id: 'ativo' }), agent({ id: 'alvo' })])

    fireEvent.click(within(openDialogFor('Agente alvo')).getByRole('button', { name: /^Confirmar$/ }))

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Credencial de agente não encontrada\./)
    )
  })
})

describe('ClientAgentsPanel — texto do dialogo de revogacao', () => {
  it('diz que e irreversivel, que o servico segue instalado e e recusado, que maquina e historico ficam, que comandos pendentes sao cancelados e que reinstalar cria registro novo', () => {
    renderPanel([agent({ id: 'ativo' }), agent({ id: 'outro' })])

    const text = openDialogFor('Agente ativo').textContent ?? ''

    expect(text).toMatch(/não pode ser desfeita/i)
    expect(text).toMatch(/continua instalado/i)
    expect(text).toMatch(/recusad/i)
    expect(text).toMatch(/histórico/i)
    expect(text).toMatch(/não são apagad/i)
    expect(text).toMatch(/comandos pendentes/i)
    expect(text).toMatch(/cancelad/i)
    expect(text).toMatch(/reinstalar/i)
    expect(text).toMatch(/registro novo/i)
  })

  it('com mais de um agente ativo, NAO mostra o aviso de ultimo agente', () => {
    renderPanel([agent({ id: 'ativo' }), agent({ id: 'outro' })])

    const text = openDialogFor('Agente ativo').textContent ?? ''

    expect(text).not.toMatch(/último agente ativo/i)
  })

  it('com um unico agente ativo, mostra o aviso explicito de ultimo agente', () => {
    renderPanel([
      agent({ id: 'unico' }),
      agent({ id: 'revogado', isActive: false, revokedAt: '2026-10-10T08:00:00.000Z' }),
    ])

    const text = openDialogFor('Agente unico').textContent ?? ''

    expect(text).toMatch(/último agente ativo/i)
    expect(text).toMatch(/nenhuma máquina reportando/i)
  })
})
