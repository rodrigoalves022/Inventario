import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getSessionPermissionUser, isAppRole, isOrgAdmin, isPlatformAdmin, ROLE_LABELS } from '@/lib/permissions'

const CSV_HEADERS = ['Nome', 'E-mail', 'Papel', 'Escopo', 'Status', 'CriadoEm']

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

/** Mesma hierarquia de escopo do schema: cliente > organizacao > plataforma. */
function formatScope(row: { organization: { name: string } | null; client: { name: string } | null }) {
  if (row.client) return `Cliente: ${row.client.name}`
  if (row.organization) return `Organização: ${row.organization.name}`
  return 'Plataforma'
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const user = getSessionPermissionUser(session)
  if (!(isPlatformAdmin(user) || isOrgAdmin(user))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // ORG_ADMIN sem organizacao cai num id que nunca existe: lista vazia em vez
  // de `organizationId: null`, que casaria com os PLATFORM_ADMIN.
  const users = await prisma.user.findMany({
    where: isPlatformAdmin(user) ? undefined : { organizationId: user.organizationId ?? '__sem_organizacao__' },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      organization: { select: { name: true } },
      client: { select: { name: true } },
    },
  })

  const lines = [
    CSV_HEADERS.join(';'),
    ...users.map((row) =>
      [
        row.name,
        row.email,
        isAppRole(row.role) ? ROLE_LABELS[row.role] : row.role,
        formatScope(row),
        row.isActive ? 'Ativo' : 'Inativo',
        row.createdAt.toISOString(),
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
      'Content-Disposition': `attachment; filename="usuarios-plataforma-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
