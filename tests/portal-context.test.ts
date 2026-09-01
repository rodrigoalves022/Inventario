import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 10, item 1. `getPortalContext`/`requirePortalDevice` (lib/portal-context.ts)
// sao o UNICO ponto de acesso do papel CLIENT_VIEWER — o portal deriva o cliente
// exclusivamente da sessao (nunca de slug/id de URL, que o portal nem aceita como
// parametro). Ate esta sprint nenhum teste chamava essas funcoes diretamente: o
// caso mais critico — um deviceId valido pertencente a OUTRO Client nunca pode
// aparecer numa resposta do portal — nunca tinha teste de regressao explicito.
//
// Mesmo padrao de tests/tenant-context.test.ts: mocka so '@/auth' e '@/lib/prisma',
// chama a funcao real (getPortalContext, requirePortalDevice), nunca mocka o guard.

type FakeClient = {
  id: string
  name: string
  slug: string
  organizationId: string
  isActive: boolean
  organizationActive: boolean
}

type FakeDevice = {
  id: string
  clientId: string
  hostname: string
}

const { clients, devices, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const devices = new Map<string, FakeDevice>()
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean; organization: { is: { isActive: boolean } } } }) => {
        const client = clients.get(where.id)
        if (!client) return null
        if (client.isActive !== where.isActive) return null
        if (client.organizationActive !== where.organization.is.isActive) return null
        return { id: client.id, name: client.name, slug: client.slug }
      }),
    },
    device: {
      // Mesmo formato de where do codigo real: id + clientId juntos na mesma
      // clausula — reproduz fielmente o isolamento que estamos provando (um
      // device de outro clientId nunca bate no findFirst, mesmo que o id exista).
      findFirst: vi.fn(async ({ where }: { where: { id: string; clientId: string } }) => {
        const device = devices.get(where.id)
        if (!device) return null
        if (device.clientId !== where.clientId) return null
        return { ...device }
      }),
    },
  }

  return { clients, devices, sessionRef, fakePrisma }
})

vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = {
    name: 'Cliente',
    organizationId: 'org-a',
    isActive: true,
    organizationActive: true,
    ...overrides,
  }
  clients.set(client.id, client)
  return client
}

function seedDevice(overrides: Partial<FakeDevice> & { id: string; clientId: string }) {
  const device: FakeDevice = { hostname: 'PC-01', ...overrides }
  devices.set(device.id, device)
  return device
}

/** Captura o digest lancado por next/navigation.notFound(), mesmo helper de tests/tenant-context.test.ts. */
async function captureNotFoundDigest(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      return String((error as { digest: unknown }).digest)
    }
    throw error
  }
}

const NOT_FOUND_DIGEST_PREFIX = 'NEXT_HTTP_ERROR_FALLBACK;404'

beforeEach(() => {
  clients.clear()
  devices.clear()
  sessionRef.user = null
  vi.clearAllMocks()
  vi.resetModules()
})

describe('getPortalContext — deriva exclusivamente da sessao', () => {
  it('sem sessao retorna null', async () => {
    const { getPortalContext } = await import('@/lib/portal-context')
    sessionRef.user = null

    expect(await getPortalContext()).toBeNull()
  })

  it('usuario que nao e CLIENT_VIEWER retorna null (nao ha portal para outros papeis)', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a' })
    const { getPortalContext } = await import('@/lib/portal-context')
    sessionRef.user = {
      id: 'user-admin',
      email: 'admin@org-a.local',
      role: 'PLATFORM_ADMIN',
      organizationId: null,
      clientId: null,
    }

    expect(await getPortalContext()).toBeNull()
  })

  it('CLIENT_VIEWER sem clientId vinculado retorna null (estado inconsistente, fail-closed)', async () => {
    const { getPortalContext } = await import('@/lib/portal-context')
    sessionRef.user = {
      id: 'user-viewer',
      email: 'portal@org-a.local',
      role: 'CLIENT_VIEWER',
      organizationId: 'org-a',
      clientId: null,
    }

    expect(await getPortalContext()).toBeNull()
  })

  it('CLIENT_VIEWER cujo Client foi desativado retorna null', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', isActive: false })
    const { getPortalContext } = await import('@/lib/portal-context')
    sessionRef.user = {
      id: 'user-viewer',
      email: 'portal@org-a.local',
      role: 'CLIENT_VIEWER',
      organizationId: 'org-a',
      clientId: 'client-a',
    }

    expect(await getPortalContext()).toBeNull()
  })

  it('CLIENT_VIEWER cuja Organization foi desativada retorna null', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationActive: false })
    const { getPortalContext } = await import('@/lib/portal-context')
    sessionRef.user = {
      id: 'user-viewer',
      email: 'portal@org-a.local',
      role: 'CLIENT_VIEWER',
      organizationId: 'org-a',
      clientId: 'client-a',
    }

    expect(await getPortalContext()).toBeNull()
  })

  it('CLIENT_VIEWER valido resolve o contexto do PROPRIO client, sem receber nenhum parametro de URL', async () => {
    seedClient({ id: 'client-a', name: 'Acme Ltda', slug: 'acme' })
    const { getPortalContext } = await import('@/lib/portal-context')
    sessionRef.user = {
      id: 'user-viewer',
      email: 'portal@acme.local',
      name: 'Fulano',
      role: 'CLIENT_VIEWER',
      organizationId: 'org-a',
      clientId: 'client-a',
    }

    // getPortalContext() nao aceita nenhum argumento — nao ha slug/id de URL
    // para injetar; o unico caminho de entrada e session.user.clientId.
    expect(getPortalContext).toHaveLength(0)

    const context = await getPortalContext()

    expect(context).toEqual({
      clientId: 'client-a',
      clientName: 'Acme Ltda',
      clientSlug: 'acme',
      viewerName: 'Fulano',
      viewerEmail: 'portal@acme.local',
    })
  })

  it('a consulta ao Client usa sempre user.clientId da sessao (nunca um segundo parametro externo)', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a' })
    seedClient({ id: 'client-b', slug: 'cliente-b' })
    const { getPortalContext } = await import('@/lib/portal-context')

    // Sessao vinculada a client-a: mesmo que existisse um client-b "mais
    // interessante", a resolucao nunca pode migrar para ele.
    sessionRef.user = {
      id: 'user-viewer',
      email: 'portal@org-a.local',
      role: 'CLIENT_VIEWER',
      organizationId: 'org-a',
      clientId: 'client-a',
    }

    const context = await getPortalContext()
    expect(context?.clientId).toBe('client-a')
    expect(fakePrisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'client-a' }) })
    )
  })
})

describe('requirePortalDevice — caso critico: nunca vaza device de outro Client', () => {
  it('device pertencente ao MESMO client do portal e retornado normalmente', async () => {
    const device = seedDevice({ id: 'device-a1', clientId: 'client-a', hostname: 'PC-A1' })
    const { requirePortalDevice } = await import('@/lib/portal-context')

    const result = await requirePortalDevice(device.id, 'client-a')

    expect(result).toMatchObject({ id: 'device-a1', clientId: 'client-a' })
  })

  it('REGRESSAO CRITICA: deviceId valido de OUTRO Client nunca e retornado — resulta em notFound() (404)', async () => {
    const foreignDevice = seedDevice({ id: 'device-b1', clientId: 'client-b', hostname: 'PC-B1-SECRETO' })
    const { requirePortalDevice } = await import('@/lib/portal-context')

    // Sessao do portal e de client-a; deviceId pedido pertence de fato a client-b.
    const digest = await captureNotFoundDigest(() => requirePortalDevice(foreignDevice.id, 'client-a'))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('deviceId inexistente tambem resulta em notFound() (404), indistinguivel do caso de outro client', async () => {
    const { requirePortalDevice } = await import('@/lib/portal-context')

    const digest = await captureNotFoundDigest(() => requirePortalDevice('device-que-nao-existe', 'client-a'))

    expect(digest).toBe(NOT_FOUND_DIGEST_PREFIX)
  })

  it('nenhum dado do device de outro client aparece no resultado, mesmo indiretamente (throw acontece antes do retorno)', async () => {
    const foreignDevice = seedDevice({ id: 'device-b1', clientId: 'client-b', hostname: 'PC-B1-SECRETO' })
    const { requirePortalDevice } = await import('@/lib/portal-context')

    let leaked: unknown = null
    try {
      leaked = await requirePortalDevice(foreignDevice.id, 'client-a')
    } catch {
      // esperado: notFound() lanca antes de qualquer "return device"
    }

    expect(leaked).toBeNull()
  })
})
