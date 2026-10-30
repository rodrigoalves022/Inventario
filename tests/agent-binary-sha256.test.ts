import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 10, item 12 (RF024): verificacao SHA-256 do auto-update, lado
// servidor. Dois blocos:
//
// 1. getAgentBinarySha256() (lib/agent-binary.ts) isolado, com um arquivo
//    SINTETICO (fs mockado, nunca o .exe real de producao) — confirma que o
//    hash calculado bate com sha256(conteudo) de verdade, que o cache por
//    mtime evita reler o arquivo quando nada mudou, e que mtime diferente
//    (build novo publicado, OU o mesmo caminho com bytes diferentes de um
//    binario adulterado/corrompido) forca recalculo e produz um hash
//    DIFERENTE do anterior — e' esse hash, nao um valor fixo, que o agente
//    usa pra decidir se o binario recebido bate com o que o servidor
//    reportou.
// 2. POST /api/agent/checkin — confirma que `updateMetadata` (que carrega o
//    sha256) so' aparece na resposta quando `isOutdated` e verdadeiro
//    (agentVersion do payload != LATEST_AGENT_VERSION).

const { statMock, readFileMock, fsState } = vi.hoisted(() => {
  const fsState: { mtimeMs: number; content: string; shouldFailStat: boolean } = {
    mtimeMs: 1000,
    content: 'binario-v1',
    shouldFailStat: false,
  }
  const statMock = vi.fn(async (_path?: unknown) => {
    if (fsState.shouldFailStat) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return { mtimeMs: fsState.mtimeMs }
  })
  const readFileMock = vi.fn(async (_path?: unknown) => Buffer.from(fsState.content))
  return { statMock, readFileMock, fsState }
})

vi.mock('node:fs/promises', () => ({ stat: statMock, readFile: readFileMock }))

function sha256Of(content: string) {
  return createHash('sha256').update(Buffer.from(content)).digest('hex')
}

beforeEach(() => {
  fsState.mtimeMs = 1000
  fsState.content = 'binario-v1'
  fsState.shouldFailStat = false
  statMock.mockClear()
  readFileMock.mockClear()
  vi.resetModules()
})

describe('getAgentBinarySha256 — cálculo e cache por mtime (arquivo sintético, nunca o binário real)', () => {
  it('calcula o SHA-256 real do conteúdo do arquivo', async () => {
    const { getAgentBinarySha256 } = await import('@/lib/agent-binary')

    const hash = await getAgentBinarySha256()

    expect(hash).toBe(sha256Of('binario-v1'))
    expect(readFileMock).toHaveBeenCalledTimes(1)
  })

  it('mesma mtime: NÃO relê o arquivo (cache hit), devolve o mesmo hash', async () => {
    const { getAgentBinarySha256 } = await import('@/lib/agent-binary')

    const first = await getAgentBinarySha256()
    const second = await getAgentBinarySha256()

    expect(second).toBe(first)
    expect(readFileMock).toHaveBeenCalledTimes(1) // não releu na segunda chamada
    expect(statMock).toHaveBeenCalledTimes(2) // stat sempre roda, so' o read e' cacheado
  })

  it('mtime diferente (build novo, ou binário adulterado/corrompido no mesmo caminho): relê e produz hash DIFERENTE', async () => {
    const { getAgentBinarySha256 } = await import('@/lib/agent-binary')

    const original = await getAgentBinarySha256()

    fsState.mtimeMs = 2000
    fsState.content = 'binario-adulterado'
    const afterTamper = await getAgentBinarySha256()

    expect(afterTamper).not.toBe(original)
    expect(afterTamper).toBe(sha256Of('binario-adulterado'))
    expect(readFileMock).toHaveBeenCalledTimes(2)
  })

  it('arquivo ausente (stat falha) retorna null, nunca lança', async () => {
    fsState.shouldFailStat = true
    const { getAgentBinarySha256 } = await import('@/lib/agent-binary')

    const hash = await getAgentBinarySha256()

    expect(hash).toBeNull()
    expect(readFileMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Wiring na rota: updateMetadata (que carrega o sha256) só populado quando
// isOutdated. Harness minimo e proprio deste arquivo, sem tocar
// tests/agent-checkin-route.test.ts (item 5, outro agente em paralelo).
// ---------------------------------------------------------------------------

type FakeDeviceRow = { id: string; agentAuthId: string; hostname: string; status: string }

const { devicesByAgentAuthId, authResultRef, fakePrisma } = vi.hoisted(() => {
  const devicesByAgentAuthId = new Map<string, FakeDeviceRow>()
  const authResultRef: { current: unknown } = { current: null }
  let counter = 0

  const fakePrisma = {
    device: {
      findUnique: vi.fn(async ({ where }: { where: { agentAuthId: string } }) => {
        const device = devicesByAgentAuthId.get(where.agentAuthId)
        return device ? { id: device.id, status: device.status } : null
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: { agentAuthId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = devicesByAgentAuthId.get(where.agentAuthId)
        if (existing) {
          Object.assign(existing, update)
          return { id: existing.id, hostname: existing.hostname, status: existing.status }
        }
        const id = `device-${++counter}`
        const created: FakeDeviceRow = { id, agentAuthId: where.agentAuthId, hostname: create.hostname as string, status: create.status as string }
        devicesByAgentAuthId.set(where.agentAuthId, created)
        return { id, hostname: created.hostname, status: created.status }
      }),
    },
    hardware: { upsert: vi.fn(async () => ({ id: 'hw-1' })) },
    collectionLog: { create: vi.fn(async () => ({ id: 'log-1' })) },
    agentCheckLog: { create: vi.fn(async () => ({ id: 'checklog-1' })) },
  }

  return { devicesByAgentAuthId, authResultRef, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => authResultRef.current),
  authErrorResponse: (result: { status: number; message: string }) => Response.json({ error: result.message }, { status: result.status }),
}))
vi.mock('@/lib/server-url', () => ({ getCurrentServerUrl: vi.fn(async () => 'https://inventario.example.com') }))
// clientId null no agentAuth (ver setAuthOk abaixo) faz a rota pular
// reconcileAlertEvents/reconcileAvailabilityEvents inteiramente — sem
// necessidade de mockar lib/alert-rules ou lib/availability-alerts aqui,
// mantendo o foco deste arquivo no gate de updateMetadata.
vi.mock('@/lib/tenant-alert-settings', () => ({ getTenantAlertSettingsByClientId: vi.fn(async () => null) }))

function setAuthOk(agentAuthId: string) {
  authResultRef.current = {
    ok: true,
    agentAuth: { id: agentAuthId, name: 'Agente Teste', clientId: null, clientName: null, clientSlug: null },
  }
}

function buildRequest(body: unknown) {
  return new NextRequest('https://inventario.example.com/api/agent/checkin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/agent/checkin — updateMetadata só preenchido quando isOutdated', () => {
  beforeEach(() => {
    devicesByAgentAuthId.clear()
    authResultRef.current = null
    fsState.mtimeMs = 1000
    fsState.content = 'binario-atual'
    fsState.shouldFailStat = false
    vi.clearAllMocks()
  })

  it('agentVersion igual à versão mais recente: updateAvailable=false, updateMetadata=null (getAgentBinarySha256 nem é chamado)', async () => {
    setAuthOk('agent-uptodate-1')

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(buildRequest({ hostname: 'PC-ATUALIZADO', agentVersion: '1.1.0' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.updateAvailable).toBeFalsy()
    expect(json.updateMetadata).toBeNull()
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it('agentVersion desatualizada: updateAvailable=true, updateMetadata com o sha256 REAL do binário servido', async () => {
    setAuthOk('agent-outdated-1')

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(buildRequest({ hostname: 'PC-DESATUALIZADO', agentVersion: '0.9.0' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.updateAvailable).toBe(true)
    expect(json.updateMetadata).toMatchObject({
      version: '1.1.0',
      url: 'https://inventario.example.com/inventario-agent.exe',
      sha256: sha256Of('binario-atual'),
    })
  })

  it('agente Linux desatualizado recebe a URL e o sha256 do binário Linux; Windows segue com o .exe', async () => {
    fsState.content = 'binario-linux'
    statMock.mockImplementation(async (path: unknown) => ({ mtimeMs: String(path).includes('linux') ? 1 : 2 }))
    readFileMock.mockImplementation(async (path: unknown) =>
      Buffer.from(String(path).includes('linux') ? 'binario-linux' : 'binario-windows'),
    )

    setAuthOk('agent-linux-1')
    const { POST } = await import('@/app/api/agent/checkin/route')
    const linux = await (
      await POST(buildRequest({ hostname: 'srv-linux', agentVersion: '0.9.0', sistema: 'Ubuntu 22.04 LTS' }))
    ).json()

    expect(linux.updateMetadata).toMatchObject({
      url: 'https://inventario.example.com/inventario-agent-linux',
      sha256: sha256Of('binario-linux'),
    })

    setAuthOk('agent-win-1')
    const win = await (
      await POST(buildRequest({ hostname: 'pc-win', agentVersion: '0.9.0', sistema: 'Windows 11 Pro' }))
    ).json()

    expect(win.updateMetadata).toMatchObject({
      url: 'https://inventario.example.com/inventario-agent.exe',
      sha256: sha256Of('binario-windows'),
    })
  })
})
