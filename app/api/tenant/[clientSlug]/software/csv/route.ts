import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { buildSoftwareCatalog } from '@/lib/software-catalog'

const CSV_HEADERS = ['Software', 'Versao', 'Fabricante', 'Conformidade', 'Qtd Maquinas', 'Maquinas']

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

  const [devices, rules] = await Promise.all([
    prisma.device.findMany({
      where: getTenantDeviceWhere(tenant.slug),
      select: {
        id: true,
        hostname: true,
        software: { select: { nome: true, versao: true, editor: true } },
      },
      orderBy: { hostname: 'asc' },
    }),
    prisma.alertRule.findMany({
      where: { clientId: tenant.id, metric: 'software_blacklisted', enabled: true },
      select: { pattern: true },
    }),
  ])

  const patterns = rules.map((rule) => (rule.pattern ?? '').trim().toLowerCase()).filter(Boolean)

  const rows = buildSoftwareCatalog(devices, patterns)
  const lines = [
    CSV_HEADERS.join(';'),
    ...rows.map((item) =>
      [
        item.nome,
        item.versao,
        item.editor,
        item.isBlacklisted ? 'Restrito' : 'Permitido',
        item.installationsCount,
        item.machines.map((machine) => machine.hostname).join(', '),
      ]
        .map(escapeCsvSafe)
        .join(';')
    ),
  ]
  const csv = `﻿${lines.join('\r\n')}\r\n`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="softwares-${tenant.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
