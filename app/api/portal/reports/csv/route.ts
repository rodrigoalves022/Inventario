import { NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-context'
import { getDeviceReportRows, renderDeviceReportCsv } from '@/lib/reports/device-report'

export async function GET() {
  const context = await getPortalContext()
  if (!context) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
  }

  const rows = await getDeviceReportRows({ clientId: context.clientId })
  const csv = renderDeviceReportCsv(rows)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventario-${context.clientSlug}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
