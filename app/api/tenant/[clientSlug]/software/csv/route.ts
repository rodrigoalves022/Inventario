import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'

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

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

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
      where: { clientId: tenant.id },
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

  const catalog = new Map<
    string,
    { nome: string; versao: string | null; editor: string | null; machines: Map<string, string>; restricted: boolean }
  >()
  for (const device of devices) {
    for (const entry of device.software) {
      const key = `${norm(entry.nome)}|${norm(entry.versao)}|${norm(entry.editor)}`
      let item = catalog.get(key)
      if (!item) {
        item = {
          nome: entry.nome,
          versao: entry.versao ?? null,
          editor: entry.editor ?? null,
          machines: new Map(),
          restricted: patterns.some((pattern) => entry.nome.toLowerCase().includes(pattern)),
        }
        catalog.set(key, item)
      }
      item.machines.set(device.id, device.hostname)
    }
  }

  const rows = Array.from(catalog.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  const lines = [
    CSV_HEADERS.join(';'),
    ...rows.map((item) =>
      [
        item.nome,
        item.versao,
        item.editor,
        item.restricted ? 'Restrito' : 'Permitido',
        item.machines.size,
        Array.from(item.machines.values()).join(', '),
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
