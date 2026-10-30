import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

const CSV_HEADERS = ['Maquina', 'IP', 'MAC', 'Gateway', 'DNS', 'Modo', 'Primaria', 'Status']

/**
 * Neutraliza CSV Formula Injection (`=`, `+`, `-`, `@`, TAB, CR viram texto com
 * apostrofo) e aplica quoting RFC 4180 para o delimitador `;`.
 */
function escapeCsvSafe(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const tenant = await getTenantContext(clientSlug)
  if (!tenant || !canAccessTenant(getSessionPermissionUser(session), tenant)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const devices = await prisma.device.findMany({
    where: getTenantDeviceWhere(tenant.slug),
    select: {
      hostname: true,
      status: true,
      networks: { select: { ip: true, mac: true, gateway: true, dns: true, dhcp: true, isPrimary: true } },
      logs: { select: { coletadoEm: true }, orderBy: { coletadoEm: 'desc' }, take: 1 },
    },
    orderBy: { hostname: 'asc' },
  })

  const lines = [
    CSV_HEADERS.join(';'),
    ...devices.flatMap((device) =>
      device.networks.map((net) =>
        [
          device.hostname,
          net.ip,
          net.mac,
          net.gateway,
          net.dns,
          net.dhcp ? 'DHCP' : 'Estatico',
          net.isPrimary ? 'Sim' : 'Nao',
          device.status,
        ]
          .map(escapeCsvSafe)
          .join(';')
      )
    ),
  ]
  const csv = `﻿${lines.join('\r\n')}\r\n`

  const safeSlug = tenant.slug.replace(/[^a-zA-Z0-9_-]/g, '_')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rede-ips-${safeSlug}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
