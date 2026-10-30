import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { LATEST_AGENT_VERSION } from '@/lib/agent-binary'
import { getDeviceReportRows, renderDeviceReportCsv } from '@/lib/reports/device-report'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'

const BOM = String.fromCharCode(0xfeff)

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const tenant = await getTenantContext(clientSlug)
  if (!tenant || !canAccessTenant(getSessionPermissionUser(session), tenant)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const tenantAlertSettings = await getTenantAlertSettingsBySlug(clientSlug)
  const effectiveAlertSettings = tenantAlertSettings ?? getDefaultAlertSettings()
  const allRows = await getDeviceReportRows(
    getTenantDeviceWhere(clientSlug),
    effectiveAlertSettings.alertOfflineHours,
    effectiveAlertSettings.alertDiskThresholdGb
  )

  const status = req.nextUrl.searchParams.get('status')
  const tab = req.nextUrl.searchParams.get('tab')
  let rows = allRows.filter((row) => row.deviceType === 'servidor')
  if (status === 'online' || status === 'offline' || status === 'warning') {
    rows = rows.filter((row) => row.status === status)
  }
  if (tab === 'outdated_agent') {
    rows = rows.filter((row) => Boolean(row.agentVersion && row.agentVersion !== LATEST_AGENT_VERSION))
  }

  const body = renderDeviceReportCsv(rows)
  const csv = body.startsWith(BOM) ? body : BOM + body
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="servidores-${tenant.slug}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
