import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

const { clients, users, auditLogs, sessionRef, fakePrisma, revalidatePath } = vi.hoisted(() => {
  type ClientRow = { id: string; name: string; slug: string; organizationId: string }
  type UserRow = {
    id: string
    email: string
    name?: string | null
    role: string
    clientId: string | null
    organizationId?: string | null
    isActive: boolean
    passwordHash?: string
  }
  const clients = new Map<string, ClientRow & Record<string, unknown>>()
  const users = new Map<string, UserRow>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const revalidatePath = vi.fn()
  let seq = 0

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
        const found = [...clients.values()].find(
          (c) => (where.id !== undefined && c.id === where.id) || (where.slug !== undefined && c.slug === where.slug)
        )
        return found ? { ...found } : null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...clients.get(where.id)!, ...data }
        clients.set(where.id, row)
        return row
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        const found = [...users.values()].find(
          (u) => (where.id !== undefined && u.id === where.id) || (where.email !== undefined && u.email === where.email)
        )
        return found ? { ...found } : null
      }),
      create: vi.fn(async ({ data }: { data: Omit<UserRow, 'id'> }) => {
        const row = { id: `u-new-${++seq}`, ...data } as UserRow
        users.set(row.id, row)
        return { id: row.id }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
        users.set(where.id, { ...users.get(where.id)!, ...data })
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        users.delete(where.id)
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }
  return { clients, users, auditLogs, sessionRef, fakePrisma, revalidatePath }
})

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

import { updateClientAction } from '@/app/admin/clients/actions'
import { addClientUserAction, removeClientUserAction, toggleClientUserAction } from '@/app/admin/clients/user-actions'

function form(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const validUpdate = {
  clientId: 'c1',
  name: 'Empresa Nova',
  slug: 'empresa-nova',
  isActive: 'true',
  discoveryEnabled: 'true',
  metricsRetentionDays: '30',
  alertsEnabled: 'true',
  alertOfflineHours: '12',
  alertDiskThresholdGb: '20',
  alertRamThresholdGb: '8',
  alertWebhookEnabled: 'true',
  alertWebhookUrl: 'https://hooks.exemplo.com.br/alertas',
}

const validUser = { clientId: 'c1', name: 'Nome do usuário', email: 'Pessoa@Dominio.com.br', password: 'senha-inicial-123' }

beforeEach(() => {
  clients.clear()
  users.clear()
  auditLogs.length = 0
  vi.clearAllMocks()
  clients.set('c1', { id: 'c1', name: 'Empresa', slug: 'empresa', organizationId: 'org-1' })
  users.set('v1', { id: 'v1', email: 'v1@dominio.com.br', role: 'CLIENT_VIEWER', clientId: 'c1', isActive: true })
  users.set('v2', { id: 'v2', email: 'v2@dominio.com.br', role: 'CLIENT_VIEWER', clientId: 'c2', isActive: true })
  users.set('adm', { id: 'adm', email: 'adm@dominio.com.br', role: 'ORG_ADMIN', clientId: 'c1', isActive: true })
  sessionRef.user = { id: 'u1', email: 'a@x.com', role: 'PLATFORM_ADMIN', organizationId: 'org-1' }
})

describe('updateClientAction com alertas e webhook', () => {
  it('grava limiares e webhook, audita client.update sem expor a URL', async () => {
    const result = await updateClientAction(form(validUpdate))

    expect(result.error).toBeNull()
    expect(fakePrisma.client.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({
        alertsEnabled: true,
        alertWebhookEnabled: true,
        alertWebhookUrl: 'https://hooks.exemplo.com.br/alertas',
        alertOfflineHours: 12,
        alertDiskThresholdGb: 20,
        alertRamThresholdGb: 8,
      }),
    })
    expect(auditLogs.map((log) => log.action)).toEqual(['client.update'])
    expect(JSON.stringify(auditLogs[0].metadataJson)).not.toContain('hooks.exemplo')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/clients/c1')
  })

  it('URL vazia limpa o webhook (null)', async () => {
    await updateClientAction(form({ ...validUpdate, alertWebhookEnabled: 'false', alertWebhookUrl: '' }))

    expect(fakePrisma.client.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({ alertWebhookEnabled: false, alertWebhookUrl: null }),
    })
  })

  it.each([
    [{ alertOfflineHours: '0' }, /offline/],
    [{ alertDiskThresholdGb: '1.5' }, /inteiro/],
    [{ alertRamThresholdGb: '5000' }, /máximo/],
    [{ alertWebhookUrl: 'ftp://x' }, /URL de webhook/],
    [{ alertWebhookUrl: '' }, /URL do webhook/],
  ])('rejeita %o', async (override, message) => {
    const result = await updateClientAction(form({ ...validUpdate, ...override }))

    expect(result.error).toMatch(message)
    expect(fakePrisma.client.update).not.toHaveBeenCalled()
  })
})

describe('addClientUserAction', () => {
  it('cria CLIENT_VIEWER no cliente e na organizacao do cliente e audita user.create', async () => {
    const result = await addClientUserAction(form(validUser))

    expect(result.error).toBeNull()
    const created = fakePrisma.user.create.mock.calls[0][0].data
    expect(created).toMatchObject({
      email: 'pessoa@dominio.com.br',
      role: 'CLIENT_VIEWER',
      clientId: 'c1',
      organizationId: 'org-1',
      isActive: true,
    })
    expect(created.passwordHash).not.toBe(validUser.password)
    expect(auditLogs.map((log) => log.action)).toEqual(['user.create'])
    expect(auditLogs[0].clientId).toBe('c1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/clients/c1')
  })

  it.each([
    [{ password: 'curta' }, /8 caracteres/],
    [{ email: 'sem-arroba' }, /e-mail válido/],
    [{ name: '' }, /nome/],
  ])('rejeita %o', async (override, message) => {
    const result = await addClientUserAction(form({ ...validUser, ...override }))

    expect(result.error).toMatch(message)
    expect(fakePrisma.user.create).not.toHaveBeenCalled()
  })

  it('rejeita e-mail ja cadastrado', async () => {
    const result = await addClientUserAction(form({ ...validUser, email: 'v1@dominio.com.br' }))

    expect(result.error).toMatch(/Já existe/)
    expect(fakePrisma.user.create).not.toHaveBeenCalled()
  })

  it('nega ORG_ADMIN de outra organizacao sem revelar o cliente', async () => {
    sessionRef.user = { id: 'u2', email: 'b@x.com', role: 'ORG_ADMIN', organizationId: 'org-2' }
    const result = await addClientUserAction(form(validUser))

    expect(result.error).toBe('Cliente não encontrado.')
    expect(fakePrisma.user.create).not.toHaveBeenCalled()
  })
})

describe('toggleClientUserAction / removeClientUserAction', () => {
  it('alterna o status e audita user.update', async () => {
    const result = await toggleClientUserAction(form({ clientId: 'c1', userId: 'v1' }))

    expect(result).toEqual({ error: null, message: 'Usuário desativado.' })
    expect(users.get('v1')!.isActive).toBe(false)
    expect(auditLogs.map((log) => log.action)).toEqual(['user.update'])
  })

  it('remove o usuario e audita user.delete antes da exclusao', async () => {
    const result = await removeClientUserAction(form({ clientId: 'c1', userId: 'v1' }))

    expect(result.error).toBeNull()
    expect(users.has('v1')).toBe(false)
    expect(auditLogs.map((log) => log.action)).toEqual(['user.delete'])
  })

  it.each([
    ['usuario de outro cliente', 'v2'],
    ['usuario que nao e CLIENT_VIEWER', 'adm'],
    ['usuario inexistente', 'nao-existe'],
  ])('recusa %s', async (_label, userId) => {
    const removed = await removeClientUserAction(form({ clientId: 'c1', userId }))
    const toggled = await toggleClientUserAction(form({ clientId: 'c1', userId }))

    expect(removed.error).toBe('Usuário não encontrado neste cliente.')
    expect(toggled.error).toBe('Usuário não encontrado neste cliente.')
    expect(fakePrisma.user.delete).not.toHaveBeenCalled()
    expect(fakePrisma.user.update).not.toHaveBeenCalled()
  })
})
