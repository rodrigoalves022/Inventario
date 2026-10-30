import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'

const CSV_HEADERS = ['Disparo', 'Resolucao', 'Estado', 'Severidade', 'Maquina', 'Regra', 'Metrica', 'Mensagem']

/** Neutraliza CSV Formula Injection e aplica quoting para o delimitador `;`. */
function escapeCsvSafe(value: string | null | undefined): string {
  let text = value ?? ''
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ clientSlug: string }> }) {
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

  const searchParams = request.nextUrl.searchParams
  const state = searchParams.get('state')
  const severity = searchParams.get('severity')

  const events = await prisma.alertEvent.findMany({
    where: {
      clientId: tenant.id,
      ...(state === 'open' ? { resolvedAt: null } : state === 'resolved' ? { resolvedAt: { not: null } } : {}),
      ...(severity === 'warning' || severity === 'critical' ? { severity } : {}),
    },
    include: { device: { select: { hostname: true } }, rule: { select: { name: true } } },
    orderBy: { firedAt: 'desc' },
    take: 1000,
  })

  const records = events.map((e) => [
    e.firedAt.toISOString(),
    e.resolvedAt ? e.resolvedAt.toISOString() : '',
    e.resolvedAt ? 'Resolvido' : 'Aberto',
    e.severity === 'critical' ? 'Critico' : e.severity === 'warning' ? 'Atencao' : e.severity,
    e.device?.hostname ?? '',
    e.rule?.name ?? '',
    e.metric,
    e.message,
  ])

  const lines = [CSV_HEADERS.join(';'), ...records.map((r) => r.map(escapeCsvSafe).join(';'))]
  const csv = `﻿${lines.join('\r\n')}\r\n`

  const safeSlug = tenant.slug.replace(/[^a-zA-Z0-9_-]/g, '')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="alertas-${safeSlug}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
