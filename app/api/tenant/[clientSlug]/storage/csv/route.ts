import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

const CSV_HEADERS = [
  'Maquina',
  'Usuario',
  'Unidade',
  'Tipo',
  'Modelo',
  'Capacidade (GB)',
  'Usado (GB)',
  'Livre (GB)',
  'Uso (%)',
  'BitLocker',
]

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
    where: getTenantDeviceWhere(tenant.slug),
    orderBy: { hostname: 'asc' },
    select: {
      hostname: true,
      usuario: true,
      disks: {
        orderBy: { unidade: 'asc' },
        select: {
          unidade: true,
          modelo: true,
          tipo: true,
          capacidadeGb: true,
          espacoLivreGb: true,
          criptografia: true,
        },
      },
    },
  })

  const lines = [CSV_HEADERS.join(';')]
  for (const device of devices) {
    for (const disk of device.disks) {
      const capacity = disk.capacidadeGb ?? null
      const free = disk.espacoLivreGb ?? null
      const used = capacity != null && free != null ? Math.max(capacity - free, 0) : null
      const usage = capacity != null && capacity > 0 && used != null ? Math.round((used / capacity) * 100) : null
      lines.push(
        [
          device.hostname,
          device.usuario,
          disk.unidade,
          disk.tipo,
          disk.modelo,
          capacity,
          used,
          free,
          usage,
          disk.criptografia,
        ]
          .map(escapeCsvSafe)
          .join(';')
      )
    }
  }
  const csv = `﻿${lines.join('\r\n')}\r\n`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="armazenamento-${tenant.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
