import { NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-context'
import { buildDeviceReportSummary, getDeviceReportRows, renderDeviceReportPdf } from '@/lib/reports/device-report'

export async function GET() {
  const context = await getPortalContext()
  if (!context) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
  }

  const rows = await getDeviceReportRows({ clientId: context.clientId })
  const summary = buildDeviceReportSummary(rows)
  const pdf = await renderDeviceReportPdf(rows, summary, {
    title: 'Relatório de inventário',
    subtitle: context.clientName,
    generatedAt: new Date(),
  })

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inventario-${context.clientSlug}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
