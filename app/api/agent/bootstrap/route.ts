import { NextRequest, NextResponse } from 'next/server'
import { buildBootstrapScript, PROVISIONING_PARAMS_ERROR, provisioningParamsSchema } from '@/lib/provisioning'
import { getCurrentServerUrl } from '@/lib/server-url'
import { getAgentBinarySha256 } from '@/lib/agent-binary'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Publica por design (client+key na query string sao a credencial) —
  // limite por IP dificulta varredura/forca bruta de chave de instalacao.
  const limit = rateLimit(`bootstrap:${getClientIp(req)}`, { limit: 20, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  // Allowlist estrita (Sprint A1a, achado N1): client/key viram codigo no
  // script .ps1 executado via `irm | iex` — fora do formato, 400 sem script.
  const parsed = provisioningParamsSchema.safeParse({
    client: req.nextUrl.searchParams.get('client'),
    key: req.nextUrl.searchParams.get('key'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: PROVISIONING_PARAMS_ERROR }, { status: 400 })
  }

  // Sprint A4 (N6): o script confere o SHA-256 do .exe baixado antes de
  // executa-lo. Sem binario publicado nao ha hash a conferir: 503, sem script.
  const expectedSha256 = await getAgentBinarySha256('windows')
  if (!expectedSha256) {
    return NextResponse.json(
      { error: 'Binário do agente para Windows não publicado neste servidor.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const serverUrl = await getCurrentServerUrl()

  let script: string
  try {
    script = buildBootstrapScript(serverUrl, parsed.data.client, parsed.data.key, expectedSha256)
  } catch (error) {
    // serverUrl vem do env ou, sem env, dos cabecalhos host/x-forwarded-*:
    // se nao passar na allowlist, nenhum script e' servido.
    console.error('[agent/bootstrap] URL do servidor rejeitada:', error instanceof Error ? error.message : 'erro desconhecido')
    return NextResponse.json({ error: 'Não foi possível gerar o script de instalação.' }, { status: 500 })
  }

  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="install-${parsed.data.client}.ps1"`,
      'Cache-Control': 'no-store',
    },
  })
}
