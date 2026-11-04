import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canManageTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getClientAgents } from '@/app/admin/clients/queries'
import { getAgentAuthState } from '@/app/admin/clients/agent-state'

const CSV_HEADERS = [
  'Cliente',
  'IDAgente',
  'NomeAgente',
  'StatusCredencial',
  'UltimoCheckin',
  'HostnameVinculado',
  'VersaoAgente',
  'UltimaColetaDispositivo',
  'CriadoEm',
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

/**
 * Sprint A54. CSV das instalacoes de agente de UM cliente, mesmo guard de
 * ClientAgentsPage: inexistente e sem permissao recebem o MESMO 404, sem
 * oraculo de existencia (RNF004).
 *
 * UltimoCheckin e UltimaColetaDispositivo vem do mesmo `lastCollectionAt`:
 * cada check-in grava um CollectionLog (AgentCheckLog so grava em erro).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const user = getSessionPermissionUser(session)
  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, organizationId: true, isActive: true },
  })

  if (!client || !canManageTenant(user, client)) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  const agents = await getClientAgents(client.id)

  const lines = [
    CSV_HEADERS.join(';'),
    ...agents.map((agent) => {
      const state = getAgentAuthState({
        isActive: agent.isActive,
        hasDevice: agent.hasDevice,
        clientIsActive: client.isActive,
      })

      return [
        client.name,
        agent.id,
        agent.name,
        state.label,
        agent.lastCollectionAt,
        agent.hostname,
        agent.agentVersion,
        agent.lastCollectionAt,
        agent.createdAt,
      ]
        .map(escapeCsvSafe)
        .join(';')
    }),
  ]
  const csv = `﻿${lines.join('\r\n')}\r\n`
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="agentes-${client.slug}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
