import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canReadTenantData, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

const CSV_HEADERS = ['Conta Local', 'Privilegio', 'Estado', 'Expiracao de Senha', 'Risco', 'Maquina']

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(clientSlug)
  if (!tenant || !canReadTenantData(user, tenant)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const devices = await prisma.device.findMany({
    where: getTenantDeviceWhere(tenant.slug),
    select: {
      hostname: true,
      localAccounts: {
        select: { usuario: true, isAdmin: true, habilitada: true, senhaNuncaExpira: true },
        orderBy: { usuario: 'asc' },
      },
    },
    orderBy: { hostname: 'asc' },
  })

  const records: string[][] = []
  for (const device of devices) {
    for (const a of device.localAccounts) {
      const risk =
        a.habilitada && a.isAdmin && a.senhaNuncaExpira
          ? 'Critico'
          : a.habilitada && (a.isAdmin || a.senhaNuncaExpira)
            ? 'Atencao'
            : 'Conforme'
      records.push([
        a.usuario,
        a.isAdmin ? 'Administrador' : 'Padrao',
        a.habilitada ? 'Habilitada' : 'Desabilitada',
        a.senhaNuncaExpira ? 'Nunca expira' : 'Expira normalmente',
        risk,
        device.hostname,
      ])
    }
  }

  const lines = [CSV_HEADERS.join(';'), ...records.map((r) => r.map(escapeCsvSafe).join(';'))]
  const csv = `﻿${lines.join('\r\n')}\r\n`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contas-locais-${tenant.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
