import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const executablePath = path.join(process.cwd(), 'agent-go', 'dist', 'inventario-agent.exe')
    const executable = await readFile(executablePath)

    return new NextResponse(executable, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.microsoft.portable-executable',
        'Content-Disposition': 'attachment; filename="inventario-agent.exe"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[agent/download] Erro:', error)
    return NextResponse.json(
      { error: 'Binario do agente nao encontrado. Gere agent-go/dist/inventario-agent.exe antes do download.' },
      { status: 503 }
    )
  }
}
