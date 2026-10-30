import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { inferVendor } from '@/lib/processor-vendor'

const CSV_HEADERS = ['Processador', 'Fabricante', 'Qtd Maquinas', 'Maquinas']

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

  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(clientSlug)
  if (!tenant || !canAccessTenant(user, tenant)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const devices = await prisma.device.findMany({
    where: {
      ...getTenantDeviceWhere(tenant.slug),
      hardware: { is: { processador: { not: null } } },
    },
    select: {
      hostname: true,
      hardware: { select: { processador: true } },
    },
    orderBy: { hostname: 'asc' },
  })

  const groups = new Map<string, { name: string; vendor: string; hostnames: string[] }>()
  for (const device of devices) {
    const name = device.hardware?.processador?.trim()
    if (!name) continue
    const entry = groups.get(name) ?? { name, vendor: inferVendor(name), hostnames: [] }
    entry.hostnames.push(device.hostname)
    groups.set(name, entry)
  }

  const rows = Array.from(groups.values()).sort(
    (a, b) => b.hostnames.length - a.hostnames.length || a.name.localeCompare(b.name)
  )
  const lines = [
    CSV_HEADERS.join(';'),
    ...rows.map((item) =>
      [item.name, item.vendor, item.hostnames.length, item.hostnames.join(', ')].map(escapeCsvSafe).join(';')
    ),
  ]
  const csv = `﻿${lines.join('\r\n')}\r\n`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="processadores-${tenant.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
