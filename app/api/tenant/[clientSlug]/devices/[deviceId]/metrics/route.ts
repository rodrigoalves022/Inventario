import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantAlertSettingsByClientId } from '@/lib/tenant-alert-settings'
import { deriveInventoryIssues, getEffectiveDeviceStatus } from '@/lib/inventory-alerts'

type Params = { clientSlug: string; deviceId: string }

// Mesma resposta (404) tanto para "dispositivo nao existe" quanto para
// "existe mas o tenant nao e' acessivel pela sessao atual" — mesmo padrao de
// requireTenantContext() (RNF004): nunca revelar a existencia de um tenant/
// dispositivo de outra organizacao via a diferenca 403 vs 404.
function notFound() {
  return NextResponse.json({ error: 'Máquina não encontrada.' }, { status: 404 })
}

/**
 * Sprint 9 (A.3). Rota de LEITURA por sessao (distinta de POST /api/agent/metrics,
 * que e' o protocolo de INGESTAO autenticado por X-Api-Key do agente) —
 * devolve as amostras mais recentes de MetricSample do dispositivo, mais um
 * snapshot de saude (status efetivo, latencia desde a ultima coleta,
 * versao do agente — Sprint 11, item B), para o polling client-side em
 * components/device-detail-tabs.tsx (DeviceMetricsSection).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const { clientSlug, deviceId } = await params
  const session = await auth()
  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(clientSlug)

  // Leitura: qualquer sessao que possa VER o tenant (mesmo escopo de
  // GET .../devices/[deviceId]/commands, que tambem usa canAccessTenant).
  if (!session?.user || !tenant || !canAccessTenant(user, tenant)) {
    return notFound()
  }

  const device = await prisma.device.findFirst({
    where: { id: deviceId, ...getTenantDeviceWhere(clientSlug) },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      agentVersion: true,
      hardware: { select: { ramTotalGb: true } },
      disks: { select: { espacoLivreGb: true } },
      logs: { orderBy: { coletadoEm: 'desc' }, take: 1, select: { coletadoEm: true } },
    },
  })

  if (!device) {
    return notFound()
  }

  const [samples, alertSettings] = await Promise.all([
    prisma.metricSample.findMany({
      where: { deviceId: device.id },
      orderBy: { collectedAt: 'desc' },
      take: 500,
      select: {
        collectedAt: true,
        cpuPercent: true,
        ramUsadaGb: true,
        ramTotalGb: true,
        discoUsadoGb: true,
        discoLivreGb: true,
        uptimeSegundos: true,
      },
    }),
    getTenantAlertSettingsByClientId(tenant.id),
  ])

  // Mesmo calculo de lib/tenant-device-rows.ts#buildTenantDeviceRow: ultima
  // coleta e' o CollectionLog mais recente, com o updatedAt do Device como
  // fallback (agente legado sem log ainda).
  const lastCollectedAt = device.logs[0]?.coletadoEm ?? device.updatedAt
  const issues = alertSettings?.alertsEnabled
    ? deriveInventoryIssues(
        {
          updatedAt: device.updatedAt,
          lastCollectionAt: lastCollectedAt,
          hardware: device.hardware,
          disks: device.disks,
        },
        alertSettings
      )
    : []
  const effectiveStatus = getEffectiveDeviceStatus(device.status, issues) as 'online' | 'warning' | 'offline'
  const checkinLatencyMinutes = Math.floor((Date.now() - lastCollectedAt.getTime()) / 60000)

  return NextResponse.json(
    {
      device: {
        id: device.id,
        status: device.status,
        effectiveStatus,
        lastCollectedAt: lastCollectedAt.toISOString(),
        checkinLatencyMinutes,
        agentVersion: device.agentVersion,
      },
      metrics: samples
        .slice()
        .reverse()
        .map((sample) => ({
          collectedAt: sample.collectedAt.toISOString(),
          cpuPercent: sample.cpuPercent,
          ramUsadaGb: sample.ramUsadaGb,
          ramTotalGb: sample.ramTotalGb,
          discoUsadoGb: sample.discoUsadoGb,
          discoLivreGb: sample.discoLivreGb,
          uptimeSegundos: sample.uptimeSegundos,
        })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
