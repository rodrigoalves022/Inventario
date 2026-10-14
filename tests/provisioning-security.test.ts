import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises } from 'fs'
import { NextRequest } from 'next/server'

// Sprint A1a — Hotfix de seguranca no bootstrap do agente (achado N1 da
// auditoria A0, severidade Alta). GET /api/agent/bootstrap e publico e o
// script .ps1 que ele devolve e' executado via `irm '<url>' | iex`: qualquer
// client/key/serverUrl que escape da aspa simples vira comando na maquina do
// cliente. Estes testes provam que a entrada fora da allowlist e' REJEITADA
// (400/throw, sem script/binario no corpo), nunca "consertada".

const { headersRef } = vi.hoisted(() => ({
  headersRef: { current: new Headers() as Headers },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => headersRef.current),
}))

// Rate limit real e' em memoria e limitaria a 20 req/5 min por IP — aqui o
// alvo e' a validacao, nao o limite (coberto em tests/rate-limit.test.ts).
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true })),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

// lib/auth importa lib/prisma (PrismaClient real) — so precisamos de
// generateEnrollmentKey, que nao toca o banco.
vi.mock('@/lib/prisma', () => ({ default: {} }))

import {
  buildBootstrapScript,
  buildProvisioningArtifacts,
  escapePowerShellSingleQuoted,
  provisioningParamsSchema,
} from '@/lib/provisioning'
import { generateEnrollmentKey } from '@/lib/auth'
import { GET as bootstrapGET } from '@/app/api/agent/bootstrap/route'
import { GET as downloadExeGET } from '@/app/api/agent/download-exe/route'

const REAL_SLUG = 'core-ti-expert'
const REAL_KEY = 'a3f1c9e07b5d42e8961f0c7a2b4d6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f9'
const SERVER_URL = 'https://inventario.example.com'
const FAKE_EXE = Buffer.from('MZ-FAKE-EXE-BYTES')

// Fragmentos injetados no MEIO do valor (o schema faz .trim(), entao
// injecao so nas pontas poderia ser removida pelo trim e mascarar o teste).
const MALICIOUS_FRAGMENTS: Array<[string, string]> = [
  ['quebra de linha \\n', '\ncalc.exe\n'],
  ['quebra de linha \\r\\n', '\r\ncalc.exe\r\n'],
  ["aspa simples ASCII '", "';calc.exe;'"],
  ['aspa U+2018', '\u2018;calc.exe;\u2018'],
  ['aspa U+2019', '\u2019;calc.exe;\u2019'],
  ['aspa U+201A', '\u201A;calc.exe;\u201A'],
  ['aspa U+201B', '\u201B;calc.exe;\u201B'],
  ['aspa dupla "', '" & calc.exe & "'],
  ['backtick', '`ncalc.exe'],
  ['subexpressao $(...)', '$(calc.exe)'],
  ['ponto e virgula ;', ';calc.exe'],
  ['pipe |', '|calc.exe'],
  ['e comercial &', '&calc.exe'],
  ['NUL', '\u0000calc.exe'],
  ['controle BEL', '\u0007'],
  ['controle ESC', '\u001b[0m'],
  ['controle DEL', '\u007f'],
  ['tabulacao', '\tcalc.exe'],
  ['calc.exe injetado', "'; Start-Process calc.exe; '"],
]

const maliciousClient = (fragment: string) => `core${fragment}ti`
const maliciousKey = (fragment: string) => `${REAL_KEY.slice(0, 32)}${fragment}${REAL_KEY.slice(32)}`

const MALICIOUS_SERVER_URLS: Array<[string, string]> = [
  ['nao parseavel', 'nao e uma url'],
  ['vazio', ''],
  ['protocolo ftp', 'ftp://inventario.example.com'],
  ['protocolo javascript', 'javascript://inventario.example.com'],
  ['protocolo file', 'file:///C:/Windows/System32'],
  ["aspa simples ASCII '", "https://inventario.example.com/';calc.exe;'"],
  ['aspa U+2018', 'https://inventario.example.com/\u2018;calc.exe;\u2018'],
  ['aspa U+2019', 'https://inventario.example.com/\u2019;calc.exe;\u2019'],
  ['aspa U+201A', 'https://inventario.example.com/\u201A;calc.exe;\u201A'],
  ['aspa U+201B', 'https://inventario.example.com/\u201B;calc.exe;\u201B'],
  ['aspa dupla "', 'https://inventario.example.com/"&calc.exe&"'],
  ['backtick', 'https://inventario.example.com/`ncalc.exe'],
  ['cifrao $', 'https://inventario.example.com/$(calc.exe)'],
  ['\\r', 'https://inventario.example.com/\rcalc.exe'],
  ['\\n', 'https://inventario.example.com/\ncalc.exe'],
  ['NUL', 'https://inventario.example.com/\u0000calc.exe'],
  ['controle BEL', 'https://inventario.example.com/\u0007'],
]

const LEGIT_SERVER_URLS = [
  'http://localhost:3000',
  'https://inventario.example.com',
  'http://192.168.0.10:3000/',
  'https://inventario.example.com/base/path',
]

function bootstrapRequest(params: Record<string, string>) {
  return new NextRequest(`http://localhost/api/agent/bootstrap?${new URLSearchParams(params).toString()}`)
}

function downloadExeRequest(params: Record<string, string>) {
  return new NextRequest(`http://localhost/api/agent/download-exe?${new URLSearchParams(params).toString()}`)
}

function expectNoScript(body: string) {
  expect(body).not.toContain('ErrorActionPreference')
  expect(body).not.toContain('$server')
  expect(body).not.toContain('install -server')
  expect(body).not.toContain('calc.exe')
}

const URL_ENV_VARS = ['INVENTARIO_SERVER_URL', 'APP_URL', 'NEXT_PUBLIC_APP_URL'] as const
const savedEnv: Partial<Record<(typeof URL_ENV_VARS)[number], string | undefined>> = {}
let readFileSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  for (const name of URL_ENV_VARS) {
    savedEnv[name] = process.env[name]
    delete process.env[name]
  }
  process.env.INVENTARIO_SERVER_URL = SERVER_URL
  headersRef.current = new Headers()

  const originalReadFile = fsPromises.readFile.bind(fsPromises)
  readFileSpy = vi.spyOn(fsPromises, 'readFile').mockImplementation((async (...args: unknown[]) => {
    const target = String(args[0])
    if (target.endsWith('inventario-agent.exe')) return FAKE_EXE
    return (originalReadFile as (...a: unknown[]) => Promise<unknown>)(...args)
  }) as typeof fsPromises.readFile)
})

afterEach(() => {
  for (const name of URL_ENV_VARS) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
  readFileSpy.mockRestore()
})

describe('provisioningParamsSchema — schema unico compartilhado', () => {
  it('aceita slug real e chave legitima de 64 hex', () => {
    expect(provisioningParamsSchema.safeParse({ client: REAL_SLUG, key: REAL_KEY }).success).toBe(true)
  })

  it('nao-regressao de formato: chave gerada por generateEnrollmentKey() passa no schema', async () => {
    const { plaintext } = await generateEnrollmentKey()
    expect(provisioningParamsSchema.safeParse({ client: REAL_SLUG, key: plaintext }).success).toBe(true)
  })

  it('limites de client: 2 e 64 aceitos; 1, 65 e maiuscula rejeitados', () => {
    const ok = (client: string) => provisioningParamsSchema.safeParse({ client, key: REAL_KEY }).success
    expect(ok('ab')).toBe(true)
    expect(ok('a'.repeat(64))).toBe(true)
    expect(ok('a')).toBe(false)
    expect(ok('a'.repeat(65))).toBe(false)
    expect(ok('Core-TI')).toBe(false)
    expect(ok('core_ti')).toBe(false)
  })

  it('limites de key: 16 e 128 aceitos; 15 e 129 rejeitados', () => {
    const ok = (key: string) => provisioningParamsSchema.safeParse({ client: REAL_SLUG, key }).success
    expect(ok('a'.repeat(16))).toBe(true)
    expect(ok('A_b-'.repeat(32))).toBe(true)
    expect(ok('a'.repeat(15))).toBe(false)
    expect(ok('a'.repeat(129))).toBe(false)
  })

  it('client/key ausentes sao rejeitados', () => {
    expect(provisioningParamsSchema.safeParse({ client: null, key: null }).success).toBe(false)
  })
})

describe('escapePowerShellSingleQuoted — segunda camada', () => {
  it.each([
    ["aspa ASCII '", "'"],
    ['U+2018', '\u2018'],
    ['U+2019', '\u2019'],
    ['U+201A', '\u201A'],
    ['U+201B', '\u201B'],
  ])('dobra %s', (_label, quote) => {
    expect(escapePowerShellSingleQuoted(`a${quote}b`)).toBe(`a${quote}${quote}b`)
  })
})

describe('buildBootstrapScript / buildProvisioningArtifacts — rejeitam client/key fora da allowlist', () => {
  it.each(MALICIOUS_FRAGMENTS)('buildBootstrapScript lanca para client com %s', (_label, fragment) => {
    expect(() => buildBootstrapScript(SERVER_URL, maliciousClient(fragment), REAL_KEY)).toThrow()
  })

  it.each(MALICIOUS_FRAGMENTS)('buildBootstrapScript lanca para key com %s', (_label, fragment) => {
    expect(() => buildBootstrapScript(SERVER_URL, REAL_SLUG, maliciousKey(fragment))).toThrow()
  })

  it.each(MALICIOUS_FRAGMENTS)('installCommand (buildProvisioningArtifacts) lanca para client com %s', (_label, fragment) => {
    expect(() => buildProvisioningArtifacts(SERVER_URL, maliciousClient(fragment), REAL_KEY)).toThrow()
  })

  it.each(MALICIOUS_FRAGMENTS)('installCommand (buildProvisioningArtifacts) lanca para key com %s', (_label, fragment) => {
    expect(() => buildProvisioningArtifacts(SERVER_URL, REAL_SLUG, maliciousKey(fragment))).toThrow()
  })

  it.each(MALICIOUS_SERVER_URLS)('buildBootstrapScript lanca para serverUrl %s', (_label, serverUrl) => {
    expect(() => buildBootstrapScript(serverUrl, REAL_SLUG, REAL_KEY)).toThrow()
  })

  it.each(MALICIOUS_SERVER_URLS)('buildProvisioningArtifacts lanca para serverUrl %s', (_label, serverUrl) => {
    expect(() => buildProvisioningArtifacts(serverUrl, REAL_SLUG, REAL_KEY)).toThrow()
  })

  it.each(LEGIT_SERVER_URLS)('entrada legitima continua funcionando (serverUrl %s)', (serverUrl) => {
    const script = buildBootstrapScript(serverUrl, REAL_SLUG, REAL_KEY)
    expect(script).toContain(`$client = '${REAL_SLUG}'`)
    expect(script).toContain(`$key = '${REAL_KEY}'`)
    expect(script).toContain(`$server = '${serverUrl.replace(/\/+$/, '')}'`)

    const artifacts = buildProvisioningArtifacts(serverUrl, REAL_SLUG, REAL_KEY)
    expect(artifacts.installCommand).toContain(`-client "${REAL_SLUG}" -key "${REAL_KEY}"`)
    expect(artifacts.bootstrapUrl).toContain(`client=${REAL_SLUG}`)
  })
})

describe('GET /api/agent/bootstrap', () => {
  it('200 com slug real e chave legitima de 64 hex', async () => {
    const res = await bootstrapGET(bootstrapRequest({ client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain(`$client = '${REAL_SLUG}'`)
    expect(body).toContain(`$key = '${REAL_KEY}'`)
    expect(body).toContain(`$server = '${SERVER_URL}'`)
  })

  it.each(MALICIOUS_FRAGMENTS)('400 sem script para client com %s', async (_label, fragment) => {
    const res = await bootstrapGET(bootstrapRequest({ client: maliciousClient(fragment), key: REAL_KEY }))
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    expectNoScript(await res.text())
  })

  it.each(MALICIOUS_FRAGMENTS)('400 sem script para key com %s', async (_label, fragment) => {
    const res = await bootstrapGET(bootstrapRequest({ client: REAL_SLUG, key: maliciousKey(fragment) }))
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    expectNoScript(await res.text())
  })

  it('400 com mensagem em pt-BR quando client/key ausentes', async () => {
    const res = await bootstrapGET(bootstrapRequest({}))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Parâmetros client e key ausentes ou fora do formato permitido.')
  })

  describe('serverUrl malicioso vindo dos cabecalhos (sem env de URL)', () => {
    beforeEach(() => {
      delete process.env.INVENTARIO_SERVER_URL
    })

    it.each<[string, Record<string, string>]>([
      ["x-forwarded-host com aspa ASCII '", { 'x-forwarded-host': "evil.local';calc.exe;'" }],
      ['x-forwarded-host com $(...)', { 'x-forwarded-host': 'evil.local$(calc.exe)' }],
      ['x-forwarded-host com backtick', { 'x-forwarded-host': 'evil.local`ncalc.exe' }],
      ['host com aspa ASCII \'', { host: "evil.local';calc.exe;'" }],
      ['host com aspa dupla', { host: 'evil.local"&calc.exe&"' }],
      ['x-forwarded-proto com protocolo nao http(s)', { host: 'evil.local', 'x-forwarded-proto': 'javascript' }],
    ])('responde erro sem script no corpo: %s', async (_label, hdrs) => {
      headersRef.current = new Headers(hdrs)
      const res = await bootstrapGET(bootstrapRequest({ client: REAL_SLUG, key: REAL_KEY }))
      expect([400, 500]).toContain(res.status)
      expect(res.headers.get('content-type')).toContain('application/json')
      expectNoScript(await res.text())
    })

    it('host legitimo nos cabecalhos continua gerando script', async () => {
      headersRef.current = new Headers({ host: 'inventario.local:3000' })
      const res = await bootstrapGET(bootstrapRequest({ client: REAL_SLUG, key: REAL_KEY }))
      expect(res.status).toBe(200)
      expect(await res.text()).toContain(`$server = 'https://inventario.local:3000'`)
    })
  })
})

describe('GET /api/agent/download-exe', () => {
  it('200 com slug real e chave legitima de 64 hex, binario com config embutida', async () => {
    const res = await downloadExeGET(downloadExeRequest({ client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(200)
    const bytes = Buffer.from(await res.arrayBuffer())
    expect(bytes.subarray(0, FAKE_EXE.length).equals(FAKE_EXE)).toBe(true)
    const tail = bytes.subarray(FAKE_EXE.length).toString('utf-8')
    expect(tail).toContain(`"client":"${REAL_SLUG}"`)
    expect(tail).toContain(`"key":"${REAL_KEY}"`)
  })

  it.each(MALICIOUS_FRAGMENTS)('400 sem binario para client com %s', async (_label, fragment) => {
    const res = await downloadExeGET(downloadExeRequest({ client: maliciousClient(fragment), key: REAL_KEY }))
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.text()
    expect(body).not.toContain('MZ-FAKE-EXE')
    expect(body).not.toContain('INV_CONFIG')
    expect(readFileSpy).not.toHaveBeenCalled()
  })

  it.each(MALICIOUS_FRAGMENTS)('400 sem binario para key com %s', async (_label, fragment) => {
    const res = await downloadExeGET(downloadExeRequest({ client: REAL_SLUG, key: maliciousKey(fragment) }))
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.text()
    expect(body).not.toContain('MZ-FAKE-EXE')
    expect(body).not.toContain('INV_CONFIG')
    expect(readFileSpy).not.toHaveBeenCalled()
  })
})
