import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentServerUrl } from '@/lib/server-url'
import path from 'path'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'

const downloadSchema = z.object({
  client: z.string().trim().min(2),
  key: z.string().trim().min(16),
})

export async function GET(req: NextRequest) {
  const parsed = downloadSchema.safeParse({
    client: req.nextUrl.searchParams.get('client'),
    key: req.nextUrl.searchParams.get('key'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametros client e key sao obrigatorios.' }, { status: 400 })
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

  // Build the tail payload
  const configBlock = JSON.stringify({
    serverUrl,
    client: parsed.data.client,
    key: parsed.data.key
  })
  
  const payloadStr = `\n<<INV_CONFIG>>${configBlock}<<INV_CONFIG>>\n`
  const payloadBytes = Buffer.from(payloadStr, 'utf-8')
  
  const modifiedExe = Buffer.concat([exeBytes, payloadBytes])

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
