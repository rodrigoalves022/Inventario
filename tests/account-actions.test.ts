import bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changePasswordAction, updateEmailAction, updateProfileNameAction } from '@/app/account/actions'

// Sprint V21 — conta propria no menu de usuario. Cobre RNF004 (o id vem da
// sessao, nunca do payload), validacao Zod, bcrypt e AuditLog (RNF009).

type FakeUser = { id: string; name: string | null; email: string; passwordHash: string; isActive: boolean }

const { users, auditLogs, sessionRef, fakePrisma, updateSession } = vi.hoisted(() => {
  const users = new Map<string, FakeUser>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const updateSession = vi.fn(async () => null)

  const fakePrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return users.has(where.id) ? { ...users.get(where.id)! } : null
        return [...users.values()].find((user) => user.email === where.email) ?? null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
        const user = users.get(where.id)!
        Object.assign(user, data)
        return user
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
  }

  return { users, auditLogs, sessionRef, fakePrisma, updateSession }
})

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)),
  unstable_update: updateSession,
}))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

const IDLE = { status: 'idle' as const, message: null }
const PASSWORD = 'senhaAtual1'

function form(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

beforeEach(async () => {
  users.clear()
  auditLogs.length = 0
  updateSession.mockClear()
  fakePrisma.user.update.mockClear()
  const passwordHash = await bcrypt.hash(PASSWORD, 4)
  users.set('u1', { id: 'u1', name: 'Ana', email: 'ana@a.com', passwordHash, isActive: true })
  users.set('u2', { id: 'u2', name: 'Bia', email: 'bia@a.com', passwordHash, isActive: true })
  sessionRef.user = { id: 'u1', email: 'ana@a.com', role: 'ORG_ADMIN', clientId: null }
})

describe('updateProfileNameAction', () => {
  it('altera o proprio nome, audita e reemite a sessao', async () => {
    const result = await updateProfileNameAction(IDLE, form({ name: '  Ana Souza ' }))
    expect(result.status).toBe('success')
    expect(users.get('u1')!.name).toBe('Ana Souza')
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({ action: 'account.name_update', targetId: 'u1', actorUserId: 'u1' })
    expect(JSON.parse(auditLogs[0].metadataJson as string)).toEqual({ previousName: 'Ana', newName: 'Ana Souza' })
    expect(updateSession).toHaveBeenCalledOnce()
  })

  it('ignora id/userId no payload: so altera a conta da sessao (RNF004)', async () => {
    await updateProfileNameAction(IDLE, form({ name: 'Invasor', id: 'u2', userId: 'u2' }))
    expect(users.get('u2')!.name).toBe('Bia')
    expect(users.get('u1')!.name).toBe('Invasor')
  })

  it('rejeita sem sessao e nome invalido', async () => {
    expect((await updateProfileNameAction(IDLE, form({ name: 'x' }))).status).toBe('error')
    expect((await updateProfileNameAction(IDLE, form({ name: '<script>' }))).status).toBe('error')
    sessionRef.user = null
    const result = await updateProfileNameAction(IDLE, form({ name: 'Ana Souza' }))
    expect(result.message).toMatch(/Sessão expirada/)
    expect(fakePrisma.user.update).not.toHaveBeenCalled()
    expect(auditLogs).toHaveLength(0)
  })

  it('rejeita usuario desativado mesmo com sessao valida', async () => {
    users.get('u1')!.isActive = false
    expect((await updateProfileNameAction(IDLE, form({ name: 'Ana Souza' }))).status).toBe('error')
    expect(fakePrisma.user.update).not.toHaveBeenCalled()
  })
})

describe('updateEmailAction', () => {
  it('exige a senha atual', async () => {
    const result = await updateEmailAction(IDLE, form({ email: 'nova@a.com', currentPassword: 'errada123' }))
    expect(result).toEqual({ status: 'error', message: 'Senha atual incorreta.' })
    expect(users.get('u1')!.email).toBe('ana@a.com')
    expect(auditLogs).toHaveLength(0)
  })

  it('recusa e-mail ja usado por outra conta', async () => {
    const result = await updateEmailAction(IDLE, form({ email: 'BIA@a.com', currentPassword: PASSWORD }))
    expect(result.message).toBe('Este e-mail já está em uso.')
    expect(users.get('u1')!.email).toBe('ana@a.com')
  })

  it('recusa formato invalido', async () => {
    const result = await updateEmailAction(IDLE, form({ email: 'nao-e-email', currentPassword: PASSWORD }))
    expect(result.status).toBe('error')
  })

  it('altera, normaliza, audita email anterior e novo e reemite a sessao', async () => {
    const result = await updateEmailAction(IDLE, form({ email: ' Nova@A.com ', currentPassword: PASSWORD }))
    expect(result.status).toBe('success')
    expect(users.get('u1')!.email).toBe('nova@a.com')
    expect(auditLogs[0]).toMatchObject({ action: 'account.email_update', targetId: 'u1' })
    expect(JSON.parse(auditLogs[0].metadataJson as string)).toEqual({
      previousEmail: 'ana@a.com',
      newEmail: 'nova@a.com',
    })
    expect(updateSession).toHaveBeenCalledOnce()
  })
})

describe('changePasswordAction', () => {
  const valid = { currentPassword: PASSWORD, newPassword: 'novaSenha9', confirmPassword: 'novaSenha9' }

  it('altera com hash bcrypt e audita sem gravar a senha', async () => {
    const result = await changePasswordAction(IDLE, form(valid))
    expect(result.status).toBe('success')
    expect(await bcrypt.compare('novaSenha9', users.get('u1')!.passwordHash)).toBe(true)
    expect(auditLogs[0]).toMatchObject({ action: 'account.password_change', targetId: 'u1' })
    expect(auditLogs[0].metadataJson).not.toMatch(/novaSenha9|senhaAtual1|\$2[aby]\$/)
  })

  it('rejeita senha atual errada, confirmacao divergente, senha fraca e senha repetida', async () => {
    const cases = [
      { ...valid, currentPassword: 'errada123' },
      { ...valid, confirmPassword: 'outra1234' },
      { ...valid, newPassword: 'curta1', confirmPassword: 'curta1' },
      { ...valid, newPassword: 'somenteletras', confirmPassword: 'somenteletras' },
      { ...valid, newPassword: PASSWORD, confirmPassword: PASSWORD },
    ]
    for (const values of cases) {
      expect((await changePasswordAction(IDLE, form(values))).status).toBe('error')
    }
    expect(fakePrisma.user.update).not.toHaveBeenCalled()
    expect(auditLogs).toHaveLength(0)
  })
})
