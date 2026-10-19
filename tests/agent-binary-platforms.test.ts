import { createHash } from 'node:crypto'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint A4, item 3 (RF032, N6). lib/agent-binary.ts passa a conhecer duas
// plataformas publicadas: `public/inventario-agent.exe` (Windows, padrao, o
// mesmo de hoje para o auto-update do checkin) e `public/inventario-agent-linux`.
// O hash de cada uma vem do arquivo DELA, com cache por mtime separado por
// plataforma. fs mockado por caminho: nunca le o binario real.

const { files, statMock, readFileMock } = vi.hoisted(() => {
  const files = new Map<string, { mtimeMs: number; content: string }>()
  const statMock = vi.fn(async (target: string) => {
    const file = files.get(String(target))
    if (!file) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return { mtimeMs: file.mtimeMs }
  })
  const readFileMock = vi.fn(async (target: string) => {
    const file = files.get(String(target))
    if (!file) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return Buffer.from(file.content)
  })
  return { files, statMock, readFileMock }
})

vi.mock('node:fs/promises', () => ({ stat: statMock, readFile: readFileMock }))

const WINDOWS_PATH = path.join(process.cwd(), 'public', 'inventario-agent.exe')
const LINUX_PATH = path.join(process.cwd(), 'public', 'inventario-agent-linux')

function sha256Of(content: string) {
  return createHash('sha256').update(Buffer.from(content)).digest('hex')
}

beforeEach(() => {
  files.clear()
  statMock.mockClear()
  readFileMock.mockClear()
  vi.resetModules()
})

describe('getAgentBinaryPath — por plataforma', () => {
  it('sem argumento devolve o .exe publicado (comportamento de hoje)', async () => {
    const { getAgentBinaryPath } = await import('@/lib/agent-binary')
    expect(getAgentBinaryPath()).toBe(WINDOWS_PATH)
    expect(getAgentBinaryPath('windows')).toBe(WINDOWS_PATH)
  })

  it("'linux' devolve public/inventario-agent-linux", async () => {
    const { getAgentBinaryPath } = await import('@/lib/agent-binary')
    expect(getAgentBinaryPath('linux')).toBe(LINUX_PATH)
  })
})

describe('getAgentBinarySha256 — por plataforma, cache separado', () => {
  it('o hash de cada plataforma e o do arquivo dela; sem argumento = Windows', async () => {
    files.set(WINDOWS_PATH, { mtimeMs: 1000, content: 'binario-windows' })
    files.set(LINUX_PATH, { mtimeMs: 1000, content: 'binario-linux' })
    const { getAgentBinarySha256 } = await import('@/lib/agent-binary')

    expect(await getAgentBinarySha256()).toBe(sha256Of('binario-windows'))
    expect(await getAgentBinarySha256('windows')).toBe(sha256Of('binario-windows'))
    expect(await getAgentBinarySha256('linux')).toBe(sha256Of('binario-linux'))
  })

  it('o cache de uma plataforma nao serve a outra, mesmo com mtime igual', async () => {
    files.set(WINDOWS_PATH, { mtimeMs: 5000, content: 'binario-windows' })
    files.set(LINUX_PATH, { mtimeMs: 5000, content: 'binario-linux' })
    const { getAgentBinarySha256 } = await import('@/lib/agent-binary')

    const windows = await getAgentBinarySha256('windows')
    const linux = await getAgentBinarySha256('linux')

    expect(linux).not.toBe(windows)
    expect(readFileMock).toHaveBeenCalledTimes(2)
    expect(readFileMock).toHaveBeenCalledWith(LINUX_PATH)

    // Segunda rodada: cache hit nas duas, nenhuma releitura.
    expect(await getAgentBinarySha256('windows')).toBe(windows)
    expect(await getAgentBinarySha256('linux')).toBe(linux)
    expect(readFileMock).toHaveBeenCalledTimes(2)
  })

  it('mudar o mtime do Linux recalcula so o Linux', async () => {
    files.set(WINDOWS_PATH, { mtimeMs: 1000, content: 'binario-windows' })
    files.set(LINUX_PATH, { mtimeMs: 1000, content: 'linux-v1' })
    const { getAgentBinarySha256 } = await import('@/lib/agent-binary')

    await getAgentBinarySha256('windows')
    await getAgentBinarySha256('linux')

    files.set(LINUX_PATH, { mtimeMs: 2000, content: 'linux-v2' })
    expect(await getAgentBinarySha256('linux')).toBe(sha256Of('linux-v2'))
    expect(await getAgentBinarySha256('windows')).toBe(sha256Of('binario-windows'))
    expect(readFileMock).toHaveBeenCalledTimes(3)
  })

  it('arquivo Linux ausente → null, sem afetar o Windows', async () => {
    files.set(WINDOWS_PATH, { mtimeMs: 1000, content: 'binario-windows' })
    const { getAgentBinarySha256 } = await import('@/lib/agent-binary')

    expect(await getAgentBinarySha256('linux')).toBeNull()
    expect(await getAgentBinarySha256('windows')).toBe(sha256Of('binario-windows'))
  })
})

describe('getPublishedAgentHashes — os dois hashes para o pacote do painel', () => {
  it('devolve o hash de cada plataforma e null para a nao publicada', async () => {
    files.set(WINDOWS_PATH, { mtimeMs: 1000, content: 'binario-windows' })
    const { getPublishedAgentHashes } = await import('@/lib/agent-binary')

    expect(await getPublishedAgentHashes()).toEqual({ windowsSha256: sha256Of('binario-windows'), linuxSha256: null })

    files.set(LINUX_PATH, { mtimeMs: 1000, content: 'binario-linux' })
    expect(await getPublishedAgentHashes()).toEqual({
      windowsSha256: sha256Of('binario-windows'),
      linuxSha256: sha256Of('binario-linux'),
    })
  })
})

describe('appendAgentConfig — bloco <<INV_CONFIG>> compartilhado', () => {
  it('anexa exatamente o bloco que download-exe montava', async () => {
    const { appendAgentConfig } = await import('@/lib/agent-binary')
    const binary = Buffer.from('BINARIO')
    const result = appendAgentConfig(binary, { serverUrl: 'https://inv.example.com', client: 'cliente', key: 'a'.repeat(32) })

    const expectedTail = `\n<<INV_CONFIG>>${JSON.stringify({
      serverUrl: 'https://inv.example.com',
      client: 'cliente',
      key: 'a'.repeat(32),
    })}<<INV_CONFIG>>\n`
    expect(result.equals(Buffer.concat([binary, Buffer.from(expectedTail, 'utf-8')]))).toBe(true)
  })
})
