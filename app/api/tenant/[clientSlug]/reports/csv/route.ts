import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getDeviceReportRows, renderDeviceReportCsv } from '@/lib/reports/device-report'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const session = await auth()
  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(clientSlug)

  if (!session?.user || !tenant || !canAccessTenant(user, tenant)) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
  }

  const rows = await getDeviceReportRows(getTenantDeviceWhere(clientSlug))
  const csv = renderDeviceReportCsv(rows)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventario-${clientSlug}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
