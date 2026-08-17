import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// Fonte única de publish: o binário efetivamente servido em
// `${serverUrl}/inventario-agent.exe` (estático, usado pelo auto-updater do
// agente) — e o mesmo arquivo que /api/agent/download e /api/agent/download-exe
// leem. `make windows` em agent-go/ publica aqui direto; não existe mais uma
// segunda cópia em agent-go/dist/ podendo divergir sem aviso.
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
