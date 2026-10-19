import { NextRequest, NextResponse } from 'next/server'
import { buildLinuxBootstrapScript, PROVISIONING_PARAMS_ERROR, provisioningParamsSchema } from '@/lib/provisioning'
import { getCurrentServerUrl } from '@/lib/server-url'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { getAgentBinarySha256 } from '@/lib/agent-binary'

export const runtime = 'nodejs'

// Sprint A4 (RF032). Script bash de instalacao Linux, executado via
// `curl -fsSL '<url>' | sudo bash`. Mesmo desenho de /api/agent/bootstrap:
// publica por design (client+key na query sao a credencial), sem banco.
export async function GET(req: NextRequest) {
  const limit = rateLimit(`bootstrap-linux:${getClientIp(req)}`, { limit: 20, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  // Allowlist estrita (A1a, N1): client/key viram codigo no script bash.
  const parsed = provisioningParamsSchema.safeParse({
    client: req.nextUrl.searchParams.get('client'),
    key: req.nextUrl.searchParams.get('key'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: PROVISIONING_PARAMS_ERROR }, { status: 400 })
  }

  // Sem binario Linux publicado nao ha hash a conferir: nenhum script e' servido.
  const expectedSha256 = await getAgentBinarySha256('linux')
  if (!expectedSha256) {
    return NextResponse.json(
      { error: 'Binário do agente para Linux não publicado neste servidor.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const serverUrl = await getCurrentServerUrl()

  let script: string
  try {
    script = buildLinuxBootstrapScript(serverUrl, parsed.data.client, parsed.data.key, expectedSha256)
  } catch (error) {
    console.error('[agent/bootstrap-linux] URL do servidor rejeitada:', error instanceof Error ? error.message : 'erro desconhecido')
    return NextResponse.json({ error: 'Não foi possível gerar o script de instalação.' }, { status: 500 })
  }

  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="install-${parsed.data.client}.sh"`,
      'Cache-Control': 'no-store',
    },
  })
}
