import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

/** Versao mais recente do agente publicada em public/ (comparada no check-in). */
export const LATEST_AGENT_VERSION = '1.1.0'

export type AgentPlatform = 'windows' | 'linux'

// Fonte única de publish: o binário efetivamente servido em
// `${serverUrl}/inventario-agent.exe` (estático, usado pelo auto-updater do
// agente) — e o mesmo arquivo que /api/agent/download e /api/agent/download-exe
// leem. `make windows` em agent-go/ publica aqui direto; não existe mais uma
// segunda cópia em agent-go/dist/ podendo divergir sem aviso.
// Sprint A4 (RF032): o binário Linux (amd64) passa a ser publicado em
// `public/inventario-agent-linux` por `node scripts/build-agent.mjs linux|all`,
// servido estático em `${serverUrl}/inventario-agent-linux` (baixado e
// conferido pelo script de GET /api/agent/bootstrap-linux) e lido por
// /api/agent/download-linux.
const BINARY_PATHS: Record<AgentPlatform, string> = {
  windows: path.join(process.cwd(), 'public', 'inventario-agent.exe'),
  linux: path.join(process.cwd(), 'public', 'inventario-agent-linux'),
}

// Cache por plataforma: o hash de uma nunca serve a outra, mesmo com mtime igual.
const cache = new Map<AgentPlatform, { mtimeMs: number; sha256: string }>()

export function getAgentBinaryPath(platform: AgentPlatform = 'windows') {
  return BINARY_PATHS[platform]
}

/**
 * Hash é recalculado só quando o mtime do binário muda (novo build publicado),
 * evitando reler+hashear o .exe em todo checkin de todo agente. Sem argumento
 * devolve o do .exe, exatamente como antes da Sprint A4 (auto-update, RF024).
 * Binário ausente → `null`, nunca lança.
 */
export async function getAgentBinarySha256(platform: AgentPlatform = 'windows'): Promise<string | null> {
  const binaryPath = BINARY_PATHS[platform]
  try {
    const stats = await stat(binaryPath)
    const cached = cache.get(platform)
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.sha256
    }

    const data = await readFile(binaryPath)
    const sha256 = createHash('sha256').update(data).digest('hex')
    cache.set(platform, { mtimeMs: stats.mtimeMs, sha256 })
    return sha256
  } catch {
    return null
  }
}

/**
 * SHA-256 dos dois binários publicados, para o pacote de instalação exibido
 * no painel (criação, rotação e "Ver credenciais"). `null` = não publicado.
 */
export async function getPublishedAgentHashes(): Promise<{ windowsSha256: string | null; linuxSha256: string | null }> {
  const [windowsSha256, linuxSha256] = await Promise.all([
    getAgentBinarySha256('windows'),
    getAgentBinarySha256('linux'),
  ])
  return { windowsSha256, linuxSha256 }
}

/**
 * Anexa ao binário o bloco `<<INV_CONFIG>>` que o agente lê do fim do próprio
 * executável (autoinstall sem argumentos). Compartilhado por
 * /api/agent/download-exe e /api/agent/download-linux: o bloco é byte a byte o
 * mesmo nas duas plataformas.
 */
export function appendAgentConfig(binary: Buffer, config: { serverUrl: string; client: string; key: string }) {
  const configBlock = JSON.stringify({
    serverUrl: config.serverUrl,
    client: config.client,
    key: config.key,
  })
  const payloadBytes = Buffer.from(`\n<<INV_CONFIG>>${configBlock}<<INV_CONFIG>>\n`, 'utf-8')
  return Buffer.concat([binary, payloadBytes])
}
