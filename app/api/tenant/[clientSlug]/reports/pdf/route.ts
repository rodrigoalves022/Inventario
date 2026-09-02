import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import {
  buildDeviceReportSummary,
  getBlacklistedSoftwareHistory,
  getDeviceReportRows,
  renderDeviceReportPdf,
} from '@/lib/reports/device-report'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const session = await auth()
  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(clientSlug)

  if (!session?.user || !tenant || !canAccessTenant(user, tenant)) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
  }

  const tenantAlertSettings = await getTenantAlertSettingsBySlug(clientSlug)
  const effectiveAlertSettings = tenantAlertSettings ?? getDefaultAlertSettings()
  const rows = await getDeviceReportRows(
    getTenantDeviceWhere(clientSlug),
    effectiveAlertSettings.alertOfflineHours,
    effectiveAlertSettings.alertDiskThresholdGb
  )
  const summary = buildDeviceReportSummary(rows)
  const blacklistedSoftware = await getBlacklistedSoftwareHistory(tenant.id)
  const pdf = await renderDeviceReportPdf(
    rows,
    summary,
    {
      title: 'Relatório de inventário',
      subtitle: tenant.name,
      generatedAt: new Date(),
    },
    { blacklistedSoftware, alertDiskThresholdGb: effectiveAlertSettings.alertDiskThresholdGb }
  )

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inventario-${clientSlug}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
