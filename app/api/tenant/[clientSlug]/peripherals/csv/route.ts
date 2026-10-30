import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canReadTenantData, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

const CSV_HEADERS = ['Categoria', 'Periferico', 'Fabricante/Driver/VID', 'Serie/Porta', 'Detalhes', 'Maquina']

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
      monitors: { select: { fabricante: true, modelo: true, serial: true, polegadas: true, conexao: true, ano: true } },
      printers: { select: { nome: true, porta: true, driver: true, padrao: true, deRede: true } },
      usbDevices: { select: { nome: true, vendorId: true, productId: true, serial: true } },
    },
    orderBy: { hostname: 'asc' },
  })

  const records: Array<Array<string | null>> = []
  for (const device of devices) {
    const machine = device.hostname
    for (const m of device.monitors) {
      const detail = `${m.polegadas ? `${m.polegadas}"` : ''}${m.conexao ? ` · ${m.conexao}` : ''}${m.ano ? ` (${m.ano})` : ''}`.trim()
      records.push(['Monitor', m.modelo || m.fabricante || 'Monitor genérico', m.fabricante, m.serial, detail || '—', machine])
    }
    for (const p of device.printers) {
      const detail = p.deRede ? (p.padrao ? 'Rede · Padrão' : 'Impressora de rede') : p.padrao ? 'Local · Padrão' : 'Local'
      records.push(['Impressora', p.nome, p.driver, p.porta, detail, machine])
    }
    for (const u of device.usbDevices) {
      const vid = u.vendorId ? `VID:${u.vendorId} PID:${u.productId ?? '—'}` : null
      records.push(['USB', u.nome, vid, u.serial, 'Dispositivo USB', machine])
    }
  }

  const lines = [CSV_HEADERS.join(';'), ...records.map((r) => r.map(escapeCsvSafe).join(';'))]
  const csv = `﻿${lines.join('\r\n')}\r\n`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="perifericos-${tenant.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
