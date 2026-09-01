import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 10, item 3. `authorizeCredentials` (lib/auth-credentials.ts, extraida
// do literal inline de CredentialsProvider() em auth.ts especificamente para
// este teste — ver comentario la para o motivo do modulo separado, sem import
// de 'next-auth') e o UNICO ponto de entrada de RF001 (login). Ate esta sprint
// nao havia teste algum: nem da comparacao de senha via bcrypt (em vez de
// comparacao direta de string), nem da resposta uniforme para senha errada
// vs. e-mail inexistente (RNF004 — sem oraculo de existencia de e-mail), nem
// do caminho de role invalido/fora do enum (o mesmo bug de dado legado
// SUPER_ADMIN ja coberto em tests/permissions.test.ts, mas aqui no ponto de
// entrada real do login, nao so no guard puro).
//
// Mocka so as bordas externas: prisma.user.findUnique/client.findUnique e
// bcrypt.compare — nunca a logica de authorizeCredentials em si.

type FakeUser = {
  id: string
  email: string
  name: string | null
  role: string
  organizationId: string | null
  clientId: string | null
  isActive: boolean
  passwordHash: string
}

const { usersByEmail, clientsById, auditLogs, bcryptCompareMock, fakePrisma } = vi.hoisted(() => {
  const usersByEmail = new Map<string, FakeUser>()
  const clientsById = new Map<string, { slug: string }>()
  const auditLogs: Array<Record<string, unknown>> = []
  const bcryptCompareMock = vi.fn(async (_plain: string, _hash: string) => false)

  const fakePrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        return usersByEmail.get(where.email) ?? null
      }),
    },
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return clientsById.get(where.id) ?? null
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
  }

  return { usersByEmail, clientsById, auditLogs, bcryptCompareMock, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('bcryptjs', () => ({ default: { compare: bcryptCompareMock } }))

function seedUser(overrides: Partial<FakeUser> & { id: string; email: string }) {
  const user: FakeUser = {
    name: 'Usuario',
    role: 'ORG_ADMIN',
    organizationId: 'org-a',
    clientId: null,
    isActive: true,
    passwordHash: 'hash-armazenado',
    ...overrides,
  }
  usersByEmail.set(user.email, user)
  return user
}

beforeEach(() => {
  usersByEmail.clear()
  clientsById.clear()
  auditLogs.length = 0
  bcryptCompareMock.mockReset()
  bcryptCompareMock.mockResolvedValue(false)
  vi.clearAllMocks()
})

describe('authorizeCredentials — login (RF001)', () => {
  it('credenciais corretas autenticam e retornam o usuario, usando bcrypt.compare (nao string direta)', async () => {
    const user = seedUser({ id: 'user-1', email: 'admin@org-a.local', passwordHash: 'hash-real-do-banco' })
    bcryptCompareMock.mockImplementation(async (plain, hash) => plain === 'senha-correta' && hash === 'hash-real-do-banco')
    const { authorizeCredentials } = await import('@/lib/auth-credentials')

    const result = await authorizeCredentials({ email: 'admin@org-a.local', password: 'senha-correta' })

    // Prova de que a comparacao passa pelo bcrypt (mock), nao por `===` direto
    // contra passwordHash: se authorizeCredentials fosse reescrito para
    // comparar a senha em claro com o hash diretamente, este mock nunca seria
    // chamado e o teste falharia aqui.
    expect(bcryptCompareMock).toHaveBeenCalledWith('senha-correta', 'hash-real-do-banco')
    expect(result).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      clientId: user.clientId,
      clientSlug: null,
    })
  })

  it('senha errada retorna null', async () => {
    seedUser({ id: 'user-1', email: 'admin@org-a.local', passwordHash: 'hash-real-do-banco' })
    bcryptCompareMock.mockResolvedValue(false)
    const { authorizeCredentials } = await import('@/lib/auth-credentials')

    const result = await authorizeCredentials({ email: 'admin@org-a.local', password: 'senha-errada' })

    expect(result).toBeNull()
    expect(bcryptCompareMock).toHaveBeenCalledWith('senha-errada', 'hash-real-do-banco')
  })

  it('e-mail inexistente retorna null — MESMA resposta (null) da senha errada, sem oraculo de existencia (RNF004)', async () => {
    const { authorizeCredentials } = await import('@/lib/auth-credentials')

    const result = await authorizeCredentials({ email: 'fantasma@org-a.local', password: 'qualquer-senha' })

    expect(result).toBeNull()
    // Sem usuario no banco, bcrypt.compare nunca e chamado — mas o retorno
    // (null) e indistinguivel do caso de senha errada para quem chama
    // authorizeCredentials, que e a garantia que RNF004 exige.
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })

  it('usuario com role invalido/fora do enum (dado legado) falha de forma segura, sem chegar a comparar senha', async () => {
    seedUser({ id: 'user-legacy', email: 'legado@org-a.local', role: 'SUPER_ADMIN', passwordHash: 'hash-legado' })
    const { authorizeCredentials } = await import('@/lib/auth-credentials')

    const result = await authorizeCredentials({ email: 'legado@org-a.local', password: 'qualquer-senha' })

    expect(result).toBeNull()
    // O guard de role (isAppRole) rejeita antes mesmo de chegar ao bcrypt —
    // mesmo bug de dado legado (SUPER_ADMIN) coberto em tests/permissions.test.ts
    // para o guard puro, aqui confirmado no ponto de entrada real do login.
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })
})
