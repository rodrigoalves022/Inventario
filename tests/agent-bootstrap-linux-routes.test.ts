import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { promises as fsPromises } from 'fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  MALICIOUS_FRAGMENTS,
  REAL_KEY,
  REAL_SLUG,
  SERVER_URL,
  maliciousClient,
  maliciousKey,
} from './provisioning-payloads'

// Sprint A4 (RF032; N6 + F4). Rotas publicas de instalacao:
// - GET /api/agent/bootstrap        (Windows) passa a exigir o hash do .exe: 503 sem binario;
// - GET /api/agent/bootstrap-linux  (nova) script bash com o hash do binario Linux;
// - GET /api/agent/download-linux   (nova) binario Linux + bloco <<INV_CONFIG>>,
//   com paridade byte a byte com download-exe.
// Todas: allowlist (provisioningParamsSchema) e rate limit ANTES de qualquer efeito.

const { binaryState, rateLimitState } = vi.hoisted(() => ({
  binaryState: {
    windowsSha256: 'a'.repeat(64) as string | null,
    linuxSha256: 'b'.repeat(64) as string | null,
    linuxPath: '' as string,
  },
  rateLimitState: { allowed: true, keys: [] as string[] },
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn((key: string) => {
    rateLimitState.keys.push(key)
    return rateLimitState.allowed ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 }
  }),
  rateLimitResponse: vi.fn((retryAfter: number) =>
    Response.json({ error: 'Muitas requisicoes.' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
  ),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/lib/agent-binary', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/agent-binary')>()
  return {
    ...original,
    getAgentBinarySha256: vi.fn(async (platform: 'windows' | 'linux' = 'windows') =>
      platform === 'linux' ? binaryState.linuxSha256 : binaryState.windowsSha256
    ),
    getAgentBinaryPath: vi.fn((platform: 'windows' | 'linux' = 'windows') =>
      platform === 'linux' ? binaryState.linuxPath : original.getAgentBinaryPath('windows')
    ),
  }
})

import { GET as bootstrapGET } from '@/app/api/agent/bootstrap/route'
import { GET as bootstrapLinuxGET } from '@/app/api/agent/bootstrap-linux/route'
import { GET as downloadLinuxGET } from '@/app/api/agent/download-linux/route'
import { GET as downloadExeGET } from '@/app/api/agent/download-exe/route'

const FAKE_LINUX = Buffer.from('\u007fELF-FAKE-LINUX-BYTES')
const FAKE_EXE = Buffer.from('MZ-FAKE-EXE-BYTES')

let tempDir = ''
let savedServerUrl: string | undefined

function request(route: string, params: Record<string, string>) {
  return new NextRequest(`http://localhost${route}?${new URLSearchParams(params).toString()}`)
}

function expectNoBashScript(body: string) {
  expect(body).not.toContain('#!/usr/bin/env bash')
  expect(body).not.toContain('EXPECTED_SHA256')
  expect(body).not.toContain('install -server')
  expect(body).not.toContain('calc.exe')
}

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'inv-a4-routes-'))
})

afterAll(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

beforeEach(() => {
  savedServerUrl = process.env.INVENTARIO_SERVER_URL
  process.env.INVENTARIO_SERVER_URL = SERVER_URL
  binaryState.windowsSha256 = 'a'.repeat(64)
  binaryState.linuxSha256 = 'b'.repeat(64)
  binaryState.linuxPath = path.join(tempDir, 'inventario-agent-linux')
  writeFileSync(binaryState.linuxPath, FAKE_LINUX)
  rateLimitState.allowed = true
  rateLimitState.keys = []
})

afterEach(() => {
  if (savedServerUrl === undefined) delete process.env.INVENTARIO_SERVER_URL
  else process.env.INVENTARIO_SERVER_URL = savedServerUrl
})

// ---------------------------------------------------------------------------
describe('GET /api/agent/bootstrap (Windows) — hash do .exe publicado', () => {
  it('200 com o hash do .exe publicado no script', async () => {
    const res = await bootstrapGET(request('/api/agent/bootstrap', { client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain(`$expectedSha256 = '${'a'.repeat(64)}'`)
    expect(body).toContain('Get-FileHash -Algorithm SHA256')
  })

  it('sem binario publicado → 503 sem script no corpo', async () => {
    binaryState.windowsSha256 = null
    const res = await bootstrapGET(request('/api/agent/bootstrap', { client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.text()
    expect(body).not.toContain('ErrorActionPreference')
    expect(body).not.toContain('install -server')
  })

  it('parametro invalido continua 400 da A1a (antes do 503)', async () => {
    binaryState.windowsSha256 = null
    const res = await bootstrapGET(request('/api/agent/bootstrap', { client: 'X', key: REAL_KEY }))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe(
      'Parâmetros client e key ausentes ou fora do formato permitido.'
    )
  })
})

// ---------------------------------------------------------------------------
describe('GET /api/agent/bootstrap-linux', () => {
  it('200 com slug e chave legitimos: cabecalhos e hash do binario Linux no script', async () => {
    const res = await bootstrapLinuxGET(request('/api/agent/bootstrap-linux', { client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="install-${REAL_SLUG}.sh"`)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.text()
    expect(body.startsWith('#!/usr/bin/env bash')).toBe(true)
    expect(body).toContain(`EXPECTED_SHA256='${'b'.repeat(64)}'`)
    expect(body).not.toContain('a'.repeat(64))
    expect(body).toContain(`SERVER='${SERVER_URL}'`)
    expect(body).toContain(`CLIENT='${REAL_SLUG}'`)
    expect(body).toContain(`KEY='${REAL_KEY}'`)
  })

  it.each(MALICIOUS_FRAGMENTS)('400 sem script para client com %s', async (_label, fragment) => {
    const res = await bootstrapLinuxGET(
      request('/api/agent/bootstrap-linux', { client: maliciousClient(fragment), key: REAL_KEY })
    )
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.text()
    expect(JSON.parse(body)).toEqual({ error: 'Parâmetros client e key ausentes ou fora do formato permitido.' })
    expectNoBashScript(body)
  })

  it.each(MALICIOUS_FRAGMENTS)('400 sem script para key com %s', async (_label, fragment) => {
    const res = await bootstrapLinuxGET(
      request('/api/agent/bootstrap-linux', { client: REAL_SLUG, key: maliciousKey(fragment) })
    )
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    expectNoBashScript(await res.text())
  })

  it('sem binario Linux publicado → 503 sem script', async () => {
    binaryState.linuxSha256 = null
    const res = await bootstrapLinuxGET(request('/api/agent/bootstrap-linux', { client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('application/json')
    expectNoBashScript(await res.text())
  })

  it('excesso de requisicoes → 429, com chave de rate limit propria', async () => {
    rateLimitState.allowed = false
    const res = await bootstrapLinuxGET(request('/api/agent/bootstrap-linux', { client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(429)
    expectNoBashScript(await res.text())
    expect(rateLimitState.keys).toEqual(['bootstrap-linux:127.0.0.1'])
  })
})

// ---------------------------------------------------------------------------
describe('GET /api/agent/download-linux', () => {
  it('200: binario + bloco <<INV_CONFIG>>, cabecalhos completos', async () => {
    const res = await downloadLinuxGET(request('/api/agent/download-linux', { client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/octet-stream')
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="inventario-agent-${REAL_SLUG}"`)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const bytes = Buffer.from(await res.arrayBuffer())
    expect(res.headers.get('content-length')).toBe(String(bytes.length))
    expect(bytes.subarray(0, FAKE_LINUX.length).equals(FAKE_LINUX)).toBe(true)
    const tail = bytes.subarray(FAKE_LINUX.length).toString('utf-8')
    expect(tail).toBe(
      `\n<<INV_CONFIG>>${JSON.stringify({ serverUrl: SERVER_URL, client: REAL_SLUG, key: REAL_KEY })}<<INV_CONFIG>>\n`
    )
  })

  it('paridade byte a byte: o bloco anexado e identico ao de download-exe para os mesmos parametros', async () => {
    const originalReadFile = fsPromises.readFile.bind(fsPromises)
    const spy = vi.spyOn(fsPromises, 'readFile').mockImplementation((async (...args: unknown[]) => {
      if (String(args[0]).endsWith('inventario-agent.exe')) return FAKE_EXE
      return (originalReadFile as (...a: unknown[]) => Promise<unknown>)(...args)
    }) as typeof fsPromises.readFile)

    try {
      const exeRes = await downloadExeGET(request('/api/agent/download-exe', { client: REAL_SLUG, key: REAL_KEY }))
      const linuxRes = await downloadLinuxGET(request('/api/agent/download-linux', { client: REAL_SLUG, key: REAL_KEY }))
      expect(exeRes.status).toBe(200)
      expect(linuxRes.status).toBe(200)
      const exeTail = Buffer.from(await exeRes.arrayBuffer()).subarray(FAKE_EXE.length)
      const linuxTail = Buffer.from(await linuxRes.arrayBuffer()).subarray(FAKE_LINUX.length)
      expect(linuxTail.equals(exeTail)).toBe(true)
      // download-exe mantem os cabecalhos de antes.
      expect(exeRes.headers.get('content-disposition')).toBe(`attachment; filename="Setup-${REAL_SLUG}.exe"`)
    } finally {
      spy.mockRestore()
    }
  })

  it.each(MALICIOUS_FRAGMENTS)('400 sem bytes de binario para client com %s', async (_label, fragment) => {
    const res = await downloadLinuxGET(
      request('/api/agent/download-linux', { client: maliciousClient(fragment), key: REAL_KEY })
    )
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.text()
    expect(body).not.toContain('ELF-FAKE')
    expect(body).not.toContain('INV_CONFIG')
  })

  it.each(MALICIOUS_FRAGMENTS)('400 sem bytes de binario para key com %s', async (_label, fragment) => {
    const res = await downloadLinuxGET(
      request('/api/agent/download-linux', { client: REAL_SLUG, key: maliciousKey(fragment) })
    )
    expect(res.status).toBe(400)
    const body = await res.text()
    expect(body).not.toContain('ELF-FAKE')
    expect(body).not.toContain('INV_CONFIG')
  })

  it('sem binario Linux → 503 sem bytes', async () => {
    binaryState.linuxPath = path.join(tempDir, 'nao-existe')
    const res = await downloadLinuxGET(request('/api/agent/download-linux', { client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.text()
    expect(body).not.toContain('INV_CONFIG')
  })

  it('excesso de requisicoes → 429, com chave de rate limit propria', async () => {
    rateLimitState.allowed = false
    const res = await downloadLinuxGET(request('/api/agent/download-linux', { client: REAL_SLUG, key: REAL_KEY }))
    expect(res.status).toBe(429)
    expect(rateLimitState.keys).toEqual(['download-linux:127.0.0.1'])
  })
})
