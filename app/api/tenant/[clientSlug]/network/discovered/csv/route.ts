import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'

const CSV_HEADERS = [
  'IP',
  'MAC',
  'Hostname',
  'Fabricante',
  'Tipo',
  'Portas Abertas',
  'Descrição SNMP',
  'Primeira Detecção',
  'Última Detecção',
]

/**
 * Neutraliza CSV Formula Injection (valores iniciados por `=`, `+`, `-`, `@`
 * viram texto com apostrofo) e aplica o quoting RFC 4180.
 */
function escapeCsvSafe(value: string | null | undefined): string {
  let text = value ?? ''
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const session = await auth()
  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(clientSlug)

  if (!session?.user || !tenant || !canAccessTenant(user, tenant)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const devices = await prisma.discoveredDevice.findMany({
    where: { clientId: tenant.id },
    orderBy: [{ deviceType: 'asc' }, { ip: 'asc' }],
  })

  const lines = [
    CSV_HEADERS.join(','),
    ...devices.map((device) =>
      [
        device.ip,
        device.mac,
        device.hostname,
        device.vendor,
        device.deviceType,
        device.openPorts,
        device.snmpSysDescr,
        device.firstSeenAt.toISOString(),
        device.lastSeenAt.toISOString(),
      ]
        .map(escapeCsvSafe)
        .join(',')
    ),
  ]
  const csv = `﻿${lines.join('\r\n')}\r\n`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dispositivos-descobertos-${tenant.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
