import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 10, item 11 (RF022): cobertura de AuditLog para login/logout.
//
// Achado confirmado por leitura de codigo (nao presumido): login (auth.ts,
// dentro de authorize() apos bcrypt.compare bem-sucedido) e logout (evento
// signOut do NextAuth) JA gravam AuditLog hoje — nao e um gap de codigo, so
// de teste. Este arquivo prova que a gravacao acontece de fato.
//
// Tecnica: auth.ts monta a config inline (`providers: [CredentialsProvider(...)]`,
// `events: { signOut }`) e passa direto para `NextAuth(config)`, sem exportar
// nada disso separadamente. Mockar so o pacote 'next-auth' (capturando o
// argumento de config) permite chamar authorize()/events.signOut() direto,
// com o CredentialsProvider real (@auth/core/providers/credentials e puro,
// so empacota o config recebido em { options: config }) e o auth.config.ts
// real (tambem puro, sem I/O).

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

type FakeUser = {
  id: string
  email: string
  passwordHash: string
  role: string
  isActive: boolean
  organizationId: string | null
  clientId: string | null
  name: string | null
}

const { usersDb, auditLogs, capturedConfigRef, fakePrisma, bcryptCompareMock } = vi.hoisted(() => {
  const usersDb = new Map<string, FakeUser>()
  const auditLogs: Array<Record<string, unknown>> = []
  const capturedConfigRef: { current: Record<string, unknown> | null } = { current: null }
  // Mock de bcrypt.compare (nao comparacao direta de string) — os hashes
  // sinteticos usam o prefixo "hashed:" pra deixar claro que passam pelo
  // "hash", nunca por igualdade de texto puro.
  const bcryptCompareMock = vi.fn(async (plain: string, hash: string) => plain === hash.replace('hashed:', ''))

  const fakePrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        const user = [...usersDb.values()].find((u) => u.email === where.email)
        return user ? { ...user } : null
      }),
    },
    client: {
      findUnique: vi.fn(async () => null),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
  }

  return { usersDb, auditLogs, capturedConfigRef, fakePrisma, bcryptCompareMock }
})

vi.mock('next-auth', () => ({
  default: vi.fn((config: Record<string, unknown>) => {
    capturedConfigRef.current = config
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }
  }),
}))
vi.mock('bcryptjs', () => ({ default: { compare: bcryptCompareMock }, compare: bcryptCompareMock }))
// auth.ts importa prisma via "./lib/prisma" (caminho relativo) — resolve para
// o mesmo arquivo absoluto que o alias "@/lib/prisma", entao o mock abaixo
// intercepta os dois.
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedUser(overrides: Partial<FakeUser> & { id: string; email: string }) {
  const user: FakeUser = {
    passwordHash: 'hashed:senha-correta',
    role: 'ORG_ADMIN',
    isActive: true,
    organizationId: 'org-a',
    clientId: null,
    name: 'Usuario Teste',
    ...overrides,
  }
  usersDb.set(user.id, user)
  return user
}

type CapturedAuthConfig = {
  providers: Array<{ options: { authorize: (credentials: unknown) => Promise<unknown> } }>
  events: { signOut: (message: unknown) => Promise<void> }
}

beforeEach(() => {
  usersDb.clear()
  auditLogs.length = 0
  capturedConfigRef.current = null
  vi.clearAllMocks()
  vi.resetModules()
})

describe('auth.ts — AuditLog de login', () => {
  it('login com credenciais validas grava AuditLog action=login com targetId do usuario', async () => {
    seedUser({ id: 'user-1', email: 'admin@org-a.local', passwordHash: 'hashed:senha-correta' })

    await import('@/auth')
    const config = capturedConfigRef.current as unknown as CapturedAuthConfig
    const authorize = config.providers[0].options.authorize

    const result = await authorize({ email: 'admin@org-a.local', password: 'senha-correta' })

    expect(result).toMatchObject({ id: 'user-1', email: 'admin@org-a.local', role: 'ORG_ADMIN' })
    expect(bcryptCompareMock).toHaveBeenCalledWith('senha-correta', 'hashed:senha-correta')
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'login',
      targetType: 'user',
      targetId: 'user-1',
      actorEmail: 'admin@org-a.local',
    })
  })

  it('login com senha incorreta NAO grava AuditLog e retorna null', async () => {
    seedUser({ id: 'user-1', email: 'admin@org-a.local', passwordHash: 'hashed:senha-correta' })

    await import('@/auth')
    const config = capturedConfigRef.current as unknown as CapturedAuthConfig
    const authorize = config.providers[0].options.authorize

    const result = await authorize({ email: 'admin@org-a.local', password: 'senha-errada' })

    expect(result).toBeNull()
    expect(auditLogs).toHaveLength(0)
  })

  it('login com e-mail inexistente NAO grava AuditLog e retorna null (mesmo formato de falha da senha errada, sem oraculo)', async () => {
    await import('@/auth')
    const config = capturedConfigRef.current as unknown as CapturedAuthConfig
    const authorize = config.providers[0].options.authorize

    const result = await authorize({ email: 'nao-existe@org-a.local', password: 'qualquer' })

    expect(result).toBeNull()
    expect(auditLogs).toHaveLength(0)
  })
})

describe('auth.ts — AuditLog de logout', () => {
  it('evento signOut do NextAuth grava AuditLog action=logout a partir do token JWT', async () => {
    await import('@/auth')
    const config = capturedConfigRef.current as unknown as CapturedAuthConfig

    await config.events.signOut({
      token: { sub: 'user-1', email: 'admin@org-a.local', role: 'ORG_ADMIN', clientId: null },
    })

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'logout',
      targetType: 'user',
      targetId: 'user-1',
      actorEmail: 'admin@org-a.local',
    })
  })

  it('evento signOut sem token (sessao de outro tipo) nao grava AuditLog nem lanca excecao', async () => {
    await import('@/auth')
    const config = capturedConfigRef.current as unknown as CapturedAuthConfig

    await expect(config.events.signOut({} as never)).resolves.toBeUndefined()
    expect(auditLogs).toHaveLength(0)
  })
})
