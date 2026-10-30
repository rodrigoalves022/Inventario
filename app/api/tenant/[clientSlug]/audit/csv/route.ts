import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canViewTenantAudit, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { listAuditLogs } from '@/lib/audit-log'
import { formatAuditActionLabel } from '@/lib/audit-action-labels'

const AUDIT_CSV_LIMIT = 1000

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null
  const date = new Date(`${value}${endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'}`)
  return Number.isNaN(date.getTime()) ? null : date
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^\s*[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const tenant = await getTenantContext(clientSlug)
  if (!tenant || !canViewTenantAudit(getSessionPermissionUser(session), tenant)) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const action = sp.get('action')
  const logs = await listAuditLogs({
    clientId: tenant.id,
    action: action && action !== 'all' ? action : null,
    actorEmail: sp.get('actorEmail') || null,
    from: parseDate(sp.get('from')),
    to: parseDate(sp.get('to'), true),
    limit: AUDIT_CSV_LIMIT,
  })

  const header = ['Data/Hora', 'Acao', 'Codigo da Acao', 'Operador', 'Papel', 'Alvo Tipo', 'Alvo ID', 'Metadados']
  const lines = logs.map((log) =>
    [
      log.createdAt,
      formatAuditActionLabel(log.action),
      log.action,
      log.actorEmail,
      log.actorRole,
      log.targetType,
      log.targetId,
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]
      .map(csvCell)
      .join(';')
  )
  const csv = `﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`
  const safeSlug = clientSlug.replace(/[^a-zA-Z0-9_-]/g, '_')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-${safeSlug}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
