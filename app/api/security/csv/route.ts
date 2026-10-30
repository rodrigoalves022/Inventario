import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
import { computeRowBitlockerStatus } from '@/lib/reports/device-report'

const CSV_HEADERS = [
  'Cliente',
  'Hostname',
  'Status',
  'UltimaColeta',
  'AntivirusAtivo',
  'AntivirusNome',
  'AssinaturasAtualizadas',
  'FirewallAtivo',
  'BitLockerStatus',
  'SecureBootAtivo',
  'UacAtivo',
  'TpmPresente',
  'ContasAdminHabilitadas',
]

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  warning: 'Em alerta',
  offline: 'Offline',
}

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

/** Nulo e "nao apurado", nunca "nao": o agente nao conseguiu ler o item. */
function formatBool(value: boolean | null | undefined) {
  if (value == null) return 'Não apurado'
  return value ? 'Sim' : 'Não'
}

function formatBitlocker(status: boolean | null) {
  if (status === null) return 'Não apurado'
  return status ? 'Ativo em todos os discos' : 'Disco sem criptografia'
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }
  if (!canAccessGlobalAdmin(getSessionPermissionUser(session))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // Mesmo recorte do painel /security: so maquinas com credencial de agente
  // ativa. Agente revogado ja aparece no KPI de credenciais revogadas.
  const devices = await prisma.device.findMany({
    where: { agentAuth: { is: { isActive: true } } },
    orderBy: [{ hostname: 'asc' }],
    include: {
      // Device nao tem relacao `client` (so o `clientId` desnormalizado); o
      // cliente vem da credencial do agente, a mesma origem desse campo.
      agentAuth: { select: { client: { select: { name: true, slug: true } } } },
      security: true,
      localAccounts: { where: { isAdmin: true, habilitada: true }, select: { usuario: true } },
      // BitLocker e por volume (Disk.criptografia), nao por SecurityPosture.
      disks: { select: { criptografia: true } },
    },
  })

  const lines = [
    CSV_HEADERS.join(';'),
    ...devices.map((device) => {
      const posture = device.security
      return [
        device.agentAuth.client?.name ?? '',
        device.hostname,
        STATUS_LABELS[device.status] ?? device.status,
        device.updatedAt.toISOString(),
        formatBool(posture?.antivirusAtivo),
        posture?.antivirusNome ?? '',
        formatBool(posture?.antivirusAtualizado),
        formatBool(posture?.firewallAtivo),
        formatBitlocker(computeRowBitlockerStatus(device.disks)),
        formatBool(posture?.secureBootAtivo),
        formatBool(posture?.uacAtivo),
        formatBool(posture?.tpmPresente),
        device.localAccounts.map((account) => account.usuario).join(', '),
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
      'Content-Disposition': `attachment; filename="seguranca-parque-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
