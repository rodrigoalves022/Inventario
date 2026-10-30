// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ClientAgentsPanel } from '@/app/admin/clients/[id]/agents/client-agents-panel'
import { requestClientAgentUpdateAction } from '@/app/admin/clients/actions'
import type { RequestAgentUpdateState } from '@/app/admin/clients/types'
import type { ClientAgentRow } from '@/app/admin/clients/queries'

// Sprint A11: atualizacao direta de agentes em /admin/clients/[id]/agents.

const { mocks } = vi.hoisted(() => ({
  mocks: {
    auth: vi.fn(),
    canManageTenant: vi.fn(),
    findAgentAuth: vi.fn(),
    findManyAgentAuth: vi.fn(),
    findClient: vi.fn(),
    createCommand: vi.fn(),
    recordAuditLog: vi.fn(),
    revalidatePath: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/permissions')>()),
  getSessionPermissionUser: () => ({ role: 'PLATFORM_ADMIN' }),
  canManageTenant: mocks.canManageTenant,
}))
vi.mock('@/lib/audit-log', () => ({
  getSessionAuditActor: () => ({ id: 'actor-1' }),
  recordAuditLog: mocks.recordAuditLog,
}))
vi.mock('@/lib/prisma', () => {
  const tx = { agentCommand: { create: mocks.createCommand } }
  return {
    default: {
      agentAuth: { findUnique: mocks.findAgentAuth, findMany: mocks.findManyAgentAuth },
      client: { findUnique: mocks.findClient },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  }
})

const CLIENT = { id: 'client-a', slug: 'a', organizationId: 'org-1' }

function form(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const initial: RequestAgentUpdateState = { error: null, message: null }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
  mocks.canManageTenant.mockReturnValue(true)
})

describe('requestClientAgentUpdateAction', () => {
  it('exige sessao', async () => {
    mocks.auth.mockResolvedValue(null)
    const result = await requestClientAgentUpdateAction(initial, form({ agentAuthId: 'x' }))
    expect(result.error).toBe('Sessão expirada. Faça login novamente.')
    expect(mocks.createCommand).not.toHaveBeenCalled()
  })

  it('enfileira update_agent para um agente e audita command.enqueue', async () => {
    mocks.findAgentAuth.mockResolvedValue({
      id: 'aa1',
      name: 'Agente 1',
      isActive: true,
      device: { id: 'dev1', hostname: 'PC-1' },
      client: CLIENT,
    })
    const result = await requestClientAgentUpdateAction(initial, form({ agentAuthId: 'aa1' }))
    expect(result).toEqual({ error: null, message: 'Comando de atualização enviado para PC-1.' })
    expect(mocks.createCommand).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentAuthId: 'aa1',
        clientId: 'client-a',
        type: 'update_agent',
        paramsJson: null,
        status: 'pending',
        expiresAt: expect.any(Date),
      }),
    })
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'command.enqueue',
        targetType: 'device',
        targetId: 'dev1',
        clientId: 'client-a',
        metadata: { commandType: 'update_agent', hostname: 'PC-1', agentAuthId: 'aa1' },
      }),
      expect.anything()
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/clients/client-a/agents')
  })

  it('recusa agente revogado e agente sem maquina', async () => {
    mocks.findAgentAuth.mockResolvedValueOnce({ id: 'a', name: 'n', isActive: false, device: null, client: CLIENT })
    expect((await requestClientAgentUpdateAction(initial, form({ agentAuthId: 'a' }))).error).toBe(
      'Credencial de agente revogada não pode receber atualização.'
    )
    mocks.findAgentAuth.mockResolvedValueOnce({ id: 'a', name: 'n', isActive: true, device: null, client: CLIENT })
    expect((await requestClientAgentUpdateAction(initial, form({ agentAuthId: 'a' }))).error).toBe(
      'Este agente ainda não possui máquina vinculada.'
    )
    expect(mocks.createCommand).not.toHaveBeenCalled()
  })

  it('nega acesso entre tenants com a mesma mensagem de inexistente', async () => {
    mocks.canManageTenant.mockReturnValue(false)
    mocks.findAgentAuth.mockResolvedValue({
      id: 'a',
      name: 'n',
      isActive: true,
      device: { id: 'd', hostname: 'h' },
      client: CLIENT,
    })
    expect((await requestClientAgentUpdateAction(initial, form({ agentAuthId: 'a' }))).error).toBe(
      'Credencial de agente não encontrada.'
    )
    mocks.findClient.mockResolvedValue(CLIENT)
    expect((await requestClientAgentUpdateAction(initial, form({ clientId: 'client-a' }))).error).toBe(
      'Cliente não encontrado.'
    )
    expect(mocks.createCommand).not.toHaveBeenCalled()
    expect(mocks.recordAuditLog).not.toHaveBeenCalled()
  })

  it('enfileira em lote para todos os agentes ativos com maquina', async () => {
    mocks.findClient.mockResolvedValue(CLIENT)
    mocks.findManyAgentAuth.mockResolvedValue([
      { id: 'a1', device: { id: 'd1', hostname: 'PC-1' } },
      { id: 'a2', device: null },
      { id: 'a3', device: { id: 'd3', hostname: 'PC-3' } },
    ])
    const result = await requestClientAgentUpdateAction(initial, form({ clientId: 'client-a' }))
    expect(result).toEqual({ error: null, message: 'Comando de atualização enviado para 2 agente(s).' })
    expect(mocks.createCommand).toHaveBeenCalledTimes(2)
    expect(mocks.createCommand.mock.calls.map(([arg]) => arg.data.agentAuthId)).toEqual(['a1', 'a3'])
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'command.bulk_enqueue',
        targetType: 'client',
        targetId: 'client-a',
        metadata: { commandType: 'update_agent', count: 2 },
      }),
      expect.anything()
    )
  })

  it('erro quando nao ha agente para atualizar em lote', async () => {
    mocks.findClient.mockResolvedValue(CLIENT)
    mocks.findManyAgentAuth.mockResolvedValue([])
    const result = await requestClientAgentUpdateAction(initial, form({ clientId: 'client-a' }))
    expect(result.error).toBe('Nenhum agente ativo com máquina vinculada para atualizar.')
  })
})

type UpdateAction = (state: RequestAgentUpdateState, payload: FormData) => Promise<RequestAgentUpdateState>

function agent(id: string, overrides: Partial<ClientAgentRow> = {}): ClientAgentRow {
  return {
    id,
    name: `Agente ${id}`,
    isActive: true,
    createdAt: '2026-10-01T12:00:00.000Z',
    revokedAt: null,
    hasDevice: true,
    hostname: `PC-${id}`,
    agentVersion: '1.1.0',
    lastCollectionAt: '2026-10-14T10:00:00.000Z',
    ...overrides,
  }
}

describe('ClientAgentsPanel - atualizacao', () => {
  let update: ReturnType<typeof vi.fn<UpdateAction>>

  function renderPanel(agents: ClientAgentRow[]) {
    return render(
      <ClientAgentsPanel
        client={{ id: 'client-a', name: 'Cliente A', isActive: true }}
        agents={agents}
        revokeAgentAuthAction={vi.fn(async () => initial)}
        requestAgentUpdateAction={update}
        latestAgentVersion="1.1.0"
      />
    )
  }

  beforeEach(() => {
    update = vi.fn<UpdateAction>(async () => ({ error: null, message: 'Comando de atualização enviado para PC-a.' }))
  })

  it('mostra Atualizado ou versao disponivel conforme a versao do agente', () => {
    renderPanel([agent('a'), agent('b', { agentVersion: '1.0.0' })])
    expect(within(screen.getByText('Agente a').closest('tr') as HTMLElement).getByText('Atualizado')).toBeTruthy()
    expect(
      within(screen.getByText('Agente b').closest('tr') as HTMLElement).getByText('v1.1.0 disponível')
    ).toBeTruthy()
  })

  it('dispara a atualizacao individual com agentAuthId', async () => {
    renderPanel([agent('a')])
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar Agente a' }))
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect((update.mock.calls[0][1] as FormData).get('agentAuthId')).toBe('a')
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Comando de atualização enviado'))
  })

  it('dispara a atualizacao em lote com clientId', async () => {
    renderPanel([agent('a'), agent('b')])
    fireEvent.click(screen.getByRole('button', { name: /Atualizar todos os agentes/ }))
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect((update.mock.calls[0][1] as FormData).get('clientId')).toBe('client-a')
  })

  it('nao oferece atualizar sem agente ativo com maquina', () => {
    renderPanel([agent('a', { hasDevice: false })])
    expect(screen.queryByRole('button', { name: /Atualizar/ })).toBeNull()
  })
})
