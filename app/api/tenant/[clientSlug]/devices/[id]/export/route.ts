import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { deduplicateDeviceSoftware } from '@/lib/software-catalog'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

const CSV_HEADERS = ['Secao', 'Item', 'Detalhe 1', 'Detalhe 2', 'Detalhe 3']

type Cell = string | number | boolean | null | undefined

/** Neutraliza CSV Formula Injection e aplica quoting para o delimitador `;`. */
function escapeCsvSafe(value: Cell): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? '' : value ? 'Sim' : 'Nao')
const fmtDate = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : '')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientSlug: string; id: string }> }
) {
  const { clientSlug, id } = await params
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const tenant = await getTenantContext(clientSlug)
  if (!tenant || !canAccessTenant(getSessionPermissionUser(session), tenant)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const device = await prisma.device.findFirst({
    where: { id, ...getTenantDeviceWhere(clientSlug) },
    include: {
      hardware: true,
      disks: true,
      networks: true,
      security: true,
      localAccounts: true,
      monitors: true,
      printers: true,
      usbDevices: true,
      assetRecord: true,
      software: { orderBy: { nome: 'asc' } },
    },
  })

  if (!device) {
    return NextResponse.json({ error: 'Dispositivo não encontrado.' }, { status: 404 })
  }

  const software = deduplicateDeviceSoftware(device.software)
  const rows: Cell[][] = []
  const add = (...cells: Cell[]) => rows.push(cells)

  add('Identificacao', 'Hostname', device.hostname)
  add('Identificacao', 'Serie', device.serial)
  add('Identificacao', 'Fabricante/Modelo', device.fabricante, device.modelo)
  add('Identificacao', 'Usuario', device.usuario)
  add('Identificacao', 'AnyDesk ID', device.anydeskId)
  add('Identificacao', 'Versao do Agente', device.agentVersion)

  const hw = device.hardware
  add('Hardware', 'Sistema Operacional', hw?.sistema, hw?.versaoSO)
  add('Hardware', 'Processador', hw?.processador)
  add('Hardware', 'RAM Total GB', hw?.ramTotalGb)
  add('Hardware', 'Placa-mae', hw?.placaMae)

  const rec = device.assetRecord
  add('Patrimonio', 'Etiqueta', rec?.etiqueta)
  add('Patrimonio', 'Responsavel', rec?.responsavel)
  add('Patrimonio', 'Localizacao', rec?.localizacao)
  add('Patrimonio', 'Centro de Custo', rec?.centroCusto)
  add('Patrimonio', 'Valor', rec?.valor)
  add('Patrimonio', 'Garantia Ate', fmtDate(rec?.garantiaAte))

  const sec = device.security
  add('Seguranca', 'Antivirus', sec?.antivirusNome, yesNo(sec?.antivirusAtivo), sec?.antivirusAtualizado === undefined ? '' : `Atualizado: ${yesNo(sec?.antivirusAtualizado)}`)
  add('Seguranca', 'Firewall', yesNo(sec?.firewallAtivo))
  add('Seguranca', 'UAC', yesNo(sec?.uacAtivo))
  add('Seguranca', 'Secure Boot', yesNo(sec?.secureBootAtivo))
  add('Seguranca', 'TPM', yesNo(sec?.tpmPresente))

  for (const d of device.disks) {
    add('Discos', d.unidade, `${d.tipo ?? ''} ${d.modelo ?? ''}`.trim(), `${d.capacidadeGb ?? ''}/${d.espacoLivreGb ?? ''}`, d.criptografia)
  }
  for (const n of device.networks) {
    add('Rede', n.ip, n.mac, [n.gateway, n.dns].filter(Boolean).join(' / '), n.isPrimary ? 'Primaria' : '')
  }
  for (const a of device.localAccounts) {
    add('Contas Locais', a.usuario, a.isAdmin ? 'Administrador' : 'Padrao', a.habilitada ? 'Habilitada' : 'Desabilitada', a.senhaNuncaExpira ? 'Nunca expira' : 'Expira normalmente')
  }
  for (const m of device.monitors) {
    add('Perifericos', 'Monitor', [m.fabricante, m.modelo].filter(Boolean).join(' '), m.serial, m.polegadas ? `${m.polegadas}"` : '')
  }
  for (const p of device.printers) {
    add('Perifericos', 'Impressora', p.nome, p.porta, p.padrao ? 'Padrao' : '')
  }
  for (const u of device.usbDevices) {
    add('Perifericos', 'USB', u.nome, u.serial, [u.vendorId, u.productId].filter(Boolean).join(':'))
  }
  for (const s of software) {
    add('Softwares', s.nome, s.versao, s.editor)
  }

  const lines = [CSV_HEADERS.join(';'), ...rows.map((r) => r.map(escapeCsvSafe).join(';'))]
  const csv = `﻿${lines.join('\r\n')}\r\n`
  const safeHostname = device.hostname.replace(/[^a-zA-Z0-9._-]/g, '_')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ficha-${safeHostname}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
