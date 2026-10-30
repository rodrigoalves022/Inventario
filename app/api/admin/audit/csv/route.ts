import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
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

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }
  if (!canAccessGlobalAdmin(getSessionPermissionUser(session))) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const action = sp.get('action')
  const clientId = sp.get('clientId')
  const logs = await listAuditLogs({
    clientId: clientId && clientId !== 'all' ? clientId : null,
    action: action && action !== 'all' ? action : null,
    actorEmail: sp.get('actorEmail') || null,
    from: parseDate(sp.get('from')),
    to: parseDate(sp.get('to'), true),
    limit: AUDIT_CSV_LIMIT,
  })

  const header = ['Data/Hora', 'Tenant ID', 'Acao', 'Codigo da Acao', 'Operador', 'Papel', 'Alvo Tipo', 'Alvo ID', 'Metadados']
  const lines = logs.map((log) =>
    [
      log.createdAt,
      log.clientId,
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

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-global-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
