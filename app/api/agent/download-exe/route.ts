import { NextRequest, NextResponse } from 'next/server'
import { PROVISIONING_PARAMS_ERROR, provisioningParamsSchema } from '@/lib/provisioning'
import { getCurrentServerUrl } from '@/lib/server-url'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { appendAgentConfig } from '@/lib/agent-binary'
import path from 'path'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const limit = rateLimit(`download-exe:${getClientIp(req)}`, { limit: 20, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  // Mesmo schema compartilhado do bootstrap (Sprint A1a, achado N1):
  // client/key fora da allowlist → 400 sem binario no corpo.
  const parsed = provisioningParamsSchema.safeParse({
    client: req.nextUrl.searchParams.get('client'),
    key: req.nextUrl.searchParams.get('key'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: PROVISIONING_PARAMS_ERROR }, { status: 400 })
  }

  const serverUrl = await getCurrentServerUrl()
  
  // Resolve path to the plain binary
  const binaryPath = path.join(process.cwd(), 'public', 'inventario-agent.exe')
  
  let exeBytes: Buffer
  try {
    exeBytes = await fs.readFile(binaryPath)
  } catch (error) {
    return NextResponse.json({ error: 'Agente binario nao encontrado no servidor.' }, { status: 500 })
  }

  // Bloco <<INV_CONFIG>> compartilhado com /api/agent/download-linux (Sprint A4).
  const modifiedExe = appendAgentConfig(exeBytes, {
    serverUrl,
    client: parsed.data.client,
    key: parsed.data.key,
  })

  return new NextResponse(modifiedExe, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.microsoft.portable-executable',
      'Content-Disposition': `attachment; filename="Setup-${parsed.data.client}.exe"`,
      'Cache-Control': 'no-store',
      'Content-Length': modifiedExe.length.toString(),
    },
  })
}
