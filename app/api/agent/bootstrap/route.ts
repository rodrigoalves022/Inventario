import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildBootstrapScript } from '@/lib/provisioning'
import { getCurrentServerUrl } from '@/lib/server-url'

export const runtime = 'nodejs'

const bootstrapSchema = z.object({
  client: z.string().trim().min(2),
  key: z.string().trim().min(16),
})

export async function GET(req: NextRequest) {
  const parsed = bootstrapSchema.safeParse({
    client: req.nextUrl.searchParams.get('client'),
    key: req.nextUrl.searchParams.get('key'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametros client e key sao obrigatorios.' }, { status: 400 })
  }

  const serverUrl = await getCurrentServerUrl()
  const script = buildBootstrapScript(serverUrl, parsed.data.client, parsed.data.key)

  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="install-${parsed.data.client}.ps1"`,
      'Cache-Control': 'no-store',
    },
  })
}
