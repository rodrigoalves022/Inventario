import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// Este é o binário efetivamente servido em `${serverUrl}/inventario-agent.exe`
// (usado pelo auto-updater do agente) — arquivo estático em public/, que hoje
// pode divergir de agent-go/dist/inventario-agent.exe (usado no bootstrap manual
// via /api/agent/download). Unificar as duas fontes de publish é um TODO em aberto.
const BINARY_PATH = path.join(process.cwd(), 'public', 'inventario-agent.exe')

let cache: { mtimeMs: number; sha256: string } | null = null

export function getAgentBinaryPath() {
  return BINARY_PATH
}

/**
 * Hash é recalculado só quando o mtime do binário muda (novo build publicado),
 * evitando reler+hashear o .exe em todo checkin de todo agente.
 */
export async function getAgentBinarySha256(): Promise<string | null> {
  try {
    const stats = await stat(BINARY_PATH)
    if (cache && cache.mtimeMs === stats.mtimeMs) {
      return cache.sha256
    }

    const data = await readFile(BINARY_PATH)
    const sha256 = createHash('sha256').update(data).digest('hex')
    cache = { mtimeMs: stats.mtimeMs, sha256 }
    return sha256
  } catch {
    return null
  }
}
