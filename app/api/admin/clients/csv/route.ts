import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getSessionPermissionUser, isOrgAdmin, isPlatformAdmin } from '@/lib/permissions'
import { getClients } from '@/app/admin/clients/queries'

const CSV_HEADERS = ['Nome', 'Slug', 'Status', 'Dispositivos', 'Agentes Ativos', 'Criado Em']

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

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const user = getSessionPermissionUser(session)
  if (!(isPlatformAdmin(user) || (isOrgAdmin(user) && Boolean(user.organizationId)))) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // getClients ja escopa por organizacao; a contagem de dispositivos reusa os mesmos ids.
  const clients = await getClients(user)
  const deviceCounts = clients.length
    ? await prisma.device.groupBy({
        by: ['clientId'],
        where: { clientId: { in: clients.map((client) => client.id) } },
        _count: { _all: true },
      })
    : []
  const devicesByClient = new Map(deviceCounts.map((row) => [row.clientId, row._count._all]))

  const lines = [
    CSV_HEADERS.join(';'),
    ...clients.map((client) =>
      [
        client.name,
        client.slug,
        client.isActive ? 'Ativo' : 'Inativo',
        devicesByClient.get(client.id) ?? 0,
        client.activeAgentCount,
        client.createdAt,
      ]
        .map(escapeCsvSafe)
        .join(';')
    ),
  ]
  const csv = `﻿${lines.join('\r\n')}\r\n`
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
