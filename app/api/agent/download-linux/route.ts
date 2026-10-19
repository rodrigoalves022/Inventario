import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { PROVISIONING_PARAMS_ERROR, provisioningParamsSchema } from '@/lib/provisioning'
import { getCurrentServerUrl } from '@/lib/server-url'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { appendAgentConfig, getAgentBinaryPath } from '@/lib/agent-binary'

export const runtime = 'nodejs'

// Sprint A4 (RF032). Binario Linux (amd64) com a configuracao do cliente
// anexada (<<INV_CONFIG>>), byte a byte o mesmo bloco de /api/agent/download-exe.
export async function GET(req: NextRequest) {
  const limit = rateLimit(`download-linux:${getClientIp(req)}`, { limit: 20, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  // Mesmo schema compartilhado (A1a): fora da allowlist → 400 sem binario.
  const parsed = provisioningParamsSchema.safeParse({
    client: req.nextUrl.searchParams.get('client'),
    key: req.nextUrl.searchParams.get('key'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: PROVISIONING_PARAMS_ERROR }, { status: 400 })
  }

  let binary: Buffer
  try {
    binary = await readFile(getAgentBinaryPath('linux'))
  } catch {
    return NextResponse.json(
      { error: 'Binário do agente para Linux não publicado neste servidor.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const serverUrl = await getCurrentServerUrl()
  const withConfig = appendAgentConfig(binary, {
    serverUrl,
    client: parsed.data.client,
    key: parsed.data.key,
  })

  return new NextResponse(new Uint8Array(withConfig), {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="inventario-agent-${parsed.data.client}"`,
      'Cache-Control': 'no-store',
      'Content-Length': withConfig.length.toString(),
    },
  })
}
