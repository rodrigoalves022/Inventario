import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint A1, E8. As mensagens de app/admin/clients/actions.ts chegam ao
// usuario (painel de clientes e assistente). Antes: sem acento ("Cliente nao
// encontrado."), "Enrollment key" e mensagens padrao do Zod 3 em ingles
// vazando por `issues[0]?.message` ("Invalid url", "Expected string, received
// null", "String must contain at least 1 character(s)").

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

type FakeClient = { id: string; name: string; slug: string; organizationId: string }

const { clients, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: string } }) => {
        const found = [...clients.values()].find(
          (c) => (where.slug !== undefined && c.slug === where.slug) || (where.id !== undefined && c.id === where.id)
        )
        return found ? { ...found } : null
      }),
      update: vi.fn(async () => undefined),
    },
    agentAuth: {
      findUnique: vi.fn(async () => null),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    $executeRaw: vi.fn(async () => undefined),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { clients, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

const initialState = { error: null, message: null, package: null }
const orgAdmin = { id: 'admin-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

function formData(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

// Fragmentos das mensagens padrao do Zod 3 em ingles.
const englishZod = /Invalid|Expected|received|String must|Required/

beforeEach(() => {
  clients.clear()
  sessionRef.user = orgAdmin
  vi.clearAllMocks()
})

describe('createClientAction — mensagens em pt-BR (E8)', () => {
  it('serverUrl invalida devolve mensagem em pt-BR', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    const result = await createClientAction(initialState, formData({ serverUrl: 'nao-e-url', name: 'Acme Ltda' }))

    expect(result.error).toBe('Informe um endereço de servidor válido, por exemplo https://inventario.suaempresa.com.')
    expect(result.error).not.toMatch(englishZod)
  })

  it('serverUrl ausente devolve mensagem em pt-BR', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    const result = await createClientAction(initialState, formData({ name: 'Acme Ltda' }))

    expect(result.error).toBe('Informe o endereço do servidor.')
  })

  it('nome ausente devolve mensagem em pt-BR', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    const result = await createClientAction(initialState, formData({ serverUrl: 'https://inventario.example.com' }))

    expect(result.error).toBe('Informe um nome com pelo menos 3 caracteres.')
  })

  it('slug com caracteres invalidos devolve mensagem acentuada', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    const result = await createClientAction(
      initialState,
      formData({ serverUrl: 'https://inventario.example.com', name: 'Acme Ltda', slug: 'Com Espaço' })
    )

    expect(result.error).toBe('Use apenas letras minúsculas, números e hifens.')
  })

  it('nome duplicado nao menciona "slug"', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    clients.set('c1', { id: 'c1', name: 'Acme Ltda', slug: 'acme-ltda', organizationId: 'org-a' })

    const result = await createClientAction(
      initialState,
      formData({ serverUrl: 'https://inventario.example.com', name: 'ACME LTDA.' })
    )

    expect(result.error).toBe('Já existe um cliente com esse nome ou com um nome equivalente.')
    expect(result.error).not.toMatch(/slug/i)
  })

  it('sem acesso administrativo devolve mensagem acentuada', async () => {
    const { createClientAction } = await import('@/app/admin/clients/actions')
    sessionRef.user = { id: 'op', email: 'op@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await createClientAction(
      initialState,
      formData({ serverUrl: 'https://inventario.example.com', name: 'Acme Ltda' })
    )

    expect(result.error).toBe('Acesso administrativo não autorizado.')
  })
})

describe('rotateEnrollmentKeyAction — mensagens em pt-BR (E8)', () => {
  it('serverUrl invalida devolve mensagem em pt-BR', async () => {
    const { rotateEnrollmentKeyAction } = await import('@/app/admin/clients/actions')
    const result = await rotateEnrollmentKeyAction(initialState, formData({ serverUrl: 'ftp//x', clientId: 'c1' }))

    expect(result.error).toBe('Informe um endereço de servidor válido, por exemplo https://inventario.suaempresa.com.')
  })

  it('clientId ausente devolve mensagem em pt-BR', async () => {
    const { rotateEnrollmentKeyAction } = await import('@/app/admin/clients/actions')
    const result = await rotateEnrollmentKeyAction(
      initialState,
      formData({ serverUrl: 'https://inventario.example.com' })
    )

    expect(result.error).toBe('Cliente não informado.')
    expect(result.error).not.toMatch(englishZod)
  })

  it('clientId vazio devolve mensagem em pt-BR', async () => {
    const { rotateEnrollmentKeyAction } = await import('@/app/admin/clients/actions')
    const result = await rotateEnrollmentKeyAction(
      initialState,
      formData({ serverUrl: 'https://inventario.example.com', clientId: '   ' })
    )

    expect(result.error).toBe('Cliente não informado.')
  })

  it('cliente inexistente devolve "Cliente não encontrado."', async () => {
    const { rotateEnrollmentKeyAction } = await import('@/app/admin/clients/actions')
    const result = await rotateEnrollmentKeyAction(
      initialState,
      formData({ serverUrl: 'https://inventario.example.com', clientId: 'inexistente' })
    )

    expect(result.error).toBe('Cliente não encontrado.')
  })

  it('sucesso fala em "chave de instalação", nunca em "Enrollment key"', async () => {
    const { rotateEnrollmentKeyAction } = await import('@/app/admin/clients/actions')
    clients.set('c1', { id: 'c1', name: 'Cliente', slug: 'cliente', organizationId: 'org-a' })

    const result = await rotateEnrollmentKeyAction(
      initialState,
      formData({ serverUrl: 'https://inventario.example.com', clientId: 'c1' })
    )

    expect(result.error).toBeNull()
    expect(result.message).toBe('Chave de instalação rotacionada. Revise os instaladores antigos.')
    expect(result.message).not.toMatch(/enrollment key/i)
  })

  it('erro interno fala em "chave de instalação"', async () => {
    const { rotateEnrollmentKeyAction } = await import('@/app/admin/clients/actions')
    clients.set('c1', { id: 'c1', name: 'Cliente', slug: 'cliente', organizationId: 'org-a' })
    fakePrisma.$transaction.mockRejectedValueOnce(new Error('db down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await rotateEnrollmentKeyAction(
      initialState,
      formData({ serverUrl: 'https://inventario.example.com', clientId: 'c1' })
    )

    consoleError.mockRestore()
    expect(result.error).toBe('Erro interno ao rotacionar a chave de instalação.')
  })
})

describe('revokeAgentAuthAction — mensagens em pt-BR (E8)', () => {
  it('agentAuthId ausente devolve mensagem em pt-BR', async () => {
    const { revokeAgentAuthAction } = await import('@/app/admin/clients/actions')
    const result = await revokeAgentAuthAction({ error: null, message: null }, formData({}))

    expect(result.error).toBe('Credencial de agente não informada.')
  })

  it('credencial inexistente devolve mensagem acentuada', async () => {
    const { revokeAgentAuthAction } = await import('@/app/admin/clients/actions')
    const result = await revokeAgentAuthAction({ error: null, message: null }, formData({ agentAuthId: 'x' }))

    expect(result.error).toBe('Credencial de agente não encontrada.')
  })
})
