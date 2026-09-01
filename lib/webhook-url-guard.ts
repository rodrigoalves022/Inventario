import net from 'node:net'
import { lookup } from 'node:dns/promises'

/**
 * Guard centralizado contra SSRF na URL de WebhookEndpoint — Sprint 11,
 * Backlog item 5 (ALTO, corrigido nesta sessao). Usado em DOIS pontos
 * deliberadamente, nao so um:
 *
 *  (a) app/app/[clientSlug]/settings/actions.ts, no Zod de create/update —
 *      feedback imediato ao usuario no formulario. SOZINHO nao protege
 *      contra DNS rebinding: o hostname pode resolver pra um IP publico no
 *      instante do cadastro e ser trocado pra um IP interno depois, sem que
 *      o cadastro mude.
 *  (b) lib/webhook-endpoints.ts, dispatchClientWebhookEndpoints — a protecao
 *      REAL: resolve o hostname de novo a CADA disparo, nunca confia na
 *      validacao feita no momento do cadastro/edicao do endpoint.
 *
 * Protocolo: SOMENTE https. Decisao deliberada (nao os dois com aviso) — quem
 * escolhe a URL e' quem administra o tenant (ORG_ADMIN, via
 * canManageTenantAlerts), nunca um usuario final anonimo recebendo um link
 * pra clicar; e' o proprio servidor, nao o navegador do usuario, quem monta
 * a conexao HTTP a cada disparo. Nao ha caso de uso legitimo pra http:// aqui,
 * e permitir os dois so adicionaria superficie sem necessidade real.
 */

export type WebhookUrlCheck = { ok: true } | { ok: false; reason: string }

// Faixas bloqueadas — RFC1918 (10/8, 172.16/12, 192.168/16), loopback (127/8),
// link-local/metadata de cloud (169.254/16, cobre 169.254.169.254) e
// "esta rede" (0.0.0.0).
const BLOCKED_IPV4_CIDRS: Array<{ base: string; prefix: number }> = [
  { base: '127.0.0.0', prefix: 8 },
  { base: '10.0.0.0', prefix: 8 },
  { base: '172.16.0.0', prefix: 12 },
  { base: '192.168.0.0', prefix: 16 },
  { base: '169.254.0.0', prefix: 16 },
  { base: '0.0.0.0', prefix: 32 },
]

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0)
}

function isIpv4Blocked(ip: string): boolean {
  const ipInt = ipv4ToInt(ip)
  return BLOCKED_IPV4_CIDRS.some(({ base, prefix }) => {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
    return (ipInt & mask) === (ipv4ToInt(base) & mask)
  })
}

// IPv6: nao reimplementa um parser completo (nao e' necessario para as faixas
// pedidas) — cobre ::1 (loopback), :: ("esta rede"), fc00::/7 (unique local,
// equivalente IPv6 do RFC1918), fe80::/10 (link-local, mesma familia de risco
// do 169.254.0.0/16) e enderecos IPv4-mapeados (::ffff:a.b.c.d), reaplicando a
// checagem de IPv4 sobre o endereco embutido.
function isIpv6Blocked(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === '::1' || normalized === '::') return true

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isIpv4Blocked(mapped[1])

  const firstHextet = parseInt(normalized.split(':')[0] || '', 16)
  if (Number.isNaN(firstHextet)) return false

  if (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) return true // fc00::/7
  if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true // fe80::/10

  return false
}

function isIpBlocked(ip: string): boolean {
  return net.isIPv4(ip) ? isIpv4Blocked(ip) : isIpv6Blocked(ip)
}

const BLOCKED_REASON = 'Endereço de destino não permitido (loopback, rede privada, link-local ou metadata de nuvem).'

export async function checkWebhookUrlSafety(rawUrl: string): Promise<WebhookUrlCheck> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'URL inválida.' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Somente URLs https:// são permitidas.' }
  }

  // URL.hostname devolve o host IPv6 literal entre colchetes (ex.: "[::1]").
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')

  if (hostname.toLowerCase() === 'localhost') {
    return { ok: false, reason: BLOCKED_REASON }
  }

  if (net.isIP(hostname)) {
    return isIpBlocked(hostname) ? { ok: false, reason: BLOCKED_REASON } : { ok: true }
  }

  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    return { ok: false, reason: 'Não foi possível resolver o hostname do webhook.' }
  }

  if (addresses.length === 0) {
    return { ok: false, reason: 'Não foi possível resolver o hostname do webhook.' }
  }

  if (addresses.some(({ address }) => isIpBlocked(address))) {
    return { ok: false, reason: BLOCKED_REASON }
  }

  return { ok: true }
}
