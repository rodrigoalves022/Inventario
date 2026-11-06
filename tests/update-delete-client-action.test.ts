import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

const { db, auditLogs, sessionRef, fakePrisma, revalidatePath } = vi.hoisted(() => {
  type Row = { id: string; name: string; slug: string; organizationId: string }
  const db = new Map<string, Row>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const revalidatePath = vi.fn()

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
        const found = [...db.values()].find(
          (c) => (where.id !== undefined && c.id === where.id) || (where.slug !== undefined && c.slug === where.slug)
        )
        return found ? { ...found } : null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = { ...db.get(where.id)!, ...data }
        db.set(row.id, row)
        return row
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        db.delete(where.id)
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
  return { db, auditLogs, sessionRef, fakePrisma, revalidatePath }
})

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

import { deleteClientAction, updateClientAction } from '@/app/admin/clients/actions'

function form(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const validUpdate = {
  clientId: 'c1',
  name: 'Acme Nova',
  slug: 'acme-nova',
  isActive: 'false',
  discoveryEnabled: 'true',
  metricsRetentionDays: '30',
}

beforeEach(() => {
  db.clear()
  auditLogs.length = 0
  vi.clearAllMocks()
  db.set('c1', { id: 'c1', name: 'Acme', slug: 'acme', organizationId: 'org-1' })
  db.set('c2', { id: 'c2', name: 'Outra', slug: 'outra', organizationId: 'org-1' })
  sessionRef.user = { id: 'u1', email: 'a@x.com', role: 'PLATFORM_ADMIN', organizationId: 'org-1' }
})

describe('updateClientAction', () => {
  it('atualiza, audita client.update e revalida a lista', async () => {
    const result = await updateClientAction(form(validUpdate))

    expect(result.error).toBeNull()
    expect(fakePrisma.client.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        name: 'Acme Nova',
        slug: 'acme-nova',
        isActive: false,
        discoveryEnabled: true,
        metricsRetentionDays: 30,
      },
    })
    expect(auditLogs.map((log) => log.action)).toEqual(['client.update'])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/clients')
  })

  it.each([
    [{ name: 'ab' }, /3 caracteres/],
    [{ slug: 'Slug Inválido' }, /minúsculas/],
    [{ metricsRetentionDays: '6' }, /mínima/],
    [{ metricsRetentionDays: '366' }, /máxima/],
    [{ metricsRetentionDays: '10.5' }, /inteiro/],
  ])('rejeita dados inválidos %o', async (override, message) => {
    const result = await updateClientAction(form({ ...validUpdate, ...override }))

    expect(result.error).toMatch(message)
    expect(fakePrisma.client.update).not.toHaveBeenCalled()
  })

  it('rejeita slug ja usado por outro cliente', async () => {
    const result = await updateClientAction(form({ ...validUpdate, slug: 'outra' }))

    expect(result.error).toMatch(/Já existe/)
    expect(fakePrisma.client.update).not.toHaveBeenCalled()
  })

  it('nega ORG_ADMIN de outra organizacao sem revelar o cliente', async () => {
    sessionRef.user = { id: 'u2', email: 'b@x.com', role: 'ORG_ADMIN', organizationId: 'org-2' }
    const result = await updateClientAction(form(validUpdate))

    expect(result.error).toBe('Cliente não encontrado.')
    expect(fakePrisma.client.update).not.toHaveBeenCalled()
  })
})

describe('deleteClientAction', () => {
  it('audita client.delete antes de excluir e revalida', async () => {
    const result = await deleteClientAction(form({ clientId: 'c1' }))

    expect(result.error).toBeNull()
    expect(db.has('c1')).toBe(false)
    expect(auditLogs.map((log) => log.action)).toEqual(['client.delete'])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/clients')
  })

  it('nega usuario sem permissao no tenant', async () => {
    sessionRef.user = { id: 'u3', email: 'c@x.com', role: 'ORG_OPERATOR', organizationId: 'org-1' }
    const result = await deleteClientAction(form({ clientId: 'c1' }))

    expect(result.error).toBe('Cliente não encontrado.')
    expect(db.has('c1')).toBe(true)
  })
})
