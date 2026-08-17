import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    // Mesmo arquivo servido em ${serverUrl}/inventario-agent.exe (estatico,
    // usado pelo auto-updater do agente) e por /api/agent/download-exe
    // (que le o mesmo caminho e so acrescenta o bloco de config). Antes,
    // esta rota lia agent-go/dist/inventario-agent.exe — uma segunda copia
    // que divergia sem aviso do arquivo publicado. `make windows` em
    // agent-go/ publica direto aqui.
    const executablePath = path.join(process.cwd(), 'public', 'inventario-agent.exe')
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
      { error: 'Binario do agente nao encontrado. Rode "make windows" em agent-go/ para publicar.' },
      { status: 503 }
    )
  }
}
