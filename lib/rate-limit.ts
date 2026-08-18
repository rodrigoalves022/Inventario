/**
 * Rate limiting em memoria de processo — janela fixa por chave, sem
 * dependencia externa (Redis etc). Suficiente para esta implantacao: um
 * processo Next.js, sem multiplas instancias horizontais. Nao sobrevive a
 * restart nem e' compartilhado entre instancias — se o projeto crescer pra
 * multiplos processos, isto precisa virar um store compartilhado.
 *
 * Protege as rotas do agente contra o cenario descrito no risco do plano:
 * "um agente comprometido pode inundar a ingestao". A chave e' o agentAuthId
 * (nao o IP) nas rotas autenticadas por API key — o que importa e' limitar
 * UM agente, nao um IP que pode estar atras de NAT com outros agentes
 * legitimos.
 */

type Bucket = { count: number; windowStart: number }

const buckets = new Map<string, Bucket>()

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
let lastCleanup = Date.now()

function cleanupStale(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) {
      buckets.delete(key)
    }
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): RateLimitResult {
  cleanupStale(options.windowMs)

  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart >= options.windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true }
  }

  if (bucket.count >= options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((options.windowMs - (now - bucket.windowStart)) / 1000)
    )
    return { allowed: false, retryAfterSeconds }
  }

  bucket.count += 1
  return { allowed: true }
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: 'Muitas requisições. Tente novamente em instantes.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
}

/** IP de origem, para rotas que ainda nao tem identidade de agente resolvida
 * (ex: register, bootstrap) — mesma extracao usada no resto do projeto. */
export function getClientIp(req: Request): string {
  const headers = req.headers
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? 'desconhecido'
}
