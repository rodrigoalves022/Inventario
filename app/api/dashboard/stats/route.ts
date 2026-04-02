import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantCollectionLogWhere, getTenantDeviceWhere, getTenantHardwareWhere } from '@/lib/tenant-scope'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug')?.trim().toLowerCase()

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug é obrigatório.' }, { status: 400 })
    }

    const tenant = await getTenantContext(clientSlug)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado ou inativo.' }, { status: 404 })
    }

    const [total, online, offline, warning, hardwareData, recentLogs] = await Promise.all([
      prisma.device.count({ where: getTenantDeviceWhere(clientSlug) }),
      prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'online' } }),
      prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'offline' } }),
      prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'warning' } }),
      prisma.hardware.findMany({
        where: getTenantHardwareWhere(clientSlug),
        select: { sistema: true, ramTotalGb: true, tipoArmazenamento: true },
      }),
      prisma.collectionLog.findMany({
        where: getTenantCollectionLogWhere(clientSlug),
        orderBy: { coletadoEm: 'desc' },
        take: 5,
        include: { device: { select: { hostname: true } } },
      }),
    ])

    const osCount: Record<string, number> = {}
    let ramTotal = 0

    for (const hardware of hardwareData) {
      if (hardware.sistema) {
        const key = hardware.sistema.includes('11')
          ? 'Windows 11'
          : hardware.sistema.includes('10')
          ? 'Windows 10'
          : hardware.sistema.includes('Server')
          ? 'Windows Server'
          : hardware.sistema
        osCount[key] = (osCount[key] ?? 0) + 1
      }
      ramTotal += hardware.ramTotalGb ?? 0
    }

    return NextResponse.json({
      tenant,
      total,
      online,
      offline,
      warning,
      ramTotalGb: ramTotal,
      osDistribution: Object.entries(osCount).map(([name, value]) => ({ name, value })),
      recentActivity: recentLogs.map((log) => ({
        hostname: log.device.hostname,
        status: log.status,
        coletadoEm: log.coletadoEm,
        ipOrigem: log.ipOrigem,
      })),
    })
  } catch (error) {
    console.error('[dashboard/stats] Erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
