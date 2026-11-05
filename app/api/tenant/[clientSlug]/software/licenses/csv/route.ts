import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canReadTenantData, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantReconciledLicenses, LICENSE_STATUS_LABELS } from '@/lib/licenses'

const CSV_HEADERS = [
  'Software',
  'Chave de Licenca',
  'Qtd Comprada',
  'Qtd Instalada',
  'Qtd Disponivel',
  'Status',
  'Contrato / NF',
  'Fornecedor',
  'Custo (R$)',
  'Vencimento',
  'Observacoes',
  'Maquinas Instaladas',
]

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

  const { items } = await getTenantReconciledLicenses(clientSlug, tenant.id)

  const rows = items.map((item) => {
    const formattedExpires = item.expiresAt
      ? new Date(item.expiresAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      : 'Vitalícia / Perpétua'

    const formattedCost = item.cost != null ? item.cost.toFixed(2) : ''
    const machinesList = item.installedDevices.map((d) => d.hostname).join(', ')

    return [
      escapeCsvSafe(item.softwareName),
      escapeCsvSafe(item.licenseKey ?? ''),
      escapeCsvSafe(item.seatsPurchased),
      escapeCsvSafe(item.seatsInstalled),
      escapeCsvSafe(item.seatsAvailable),
      escapeCsvSafe(LICENSE_STATUS_LABELS[item.status]),
      escapeCsvSafe(item.contractRef ?? ''),
      escapeCsvSafe(item.supplier ?? ''),
      escapeCsvSafe(formattedCost),
      escapeCsvSafe(formattedExpires),
      escapeCsvSafe(item.notes ?? ''),
      escapeCsvSafe(machinesList),
    ].join(';')
  })

  const csvContent = '\uFEFF' + [CSV_HEADERS.join(';'), ...rows].join('\r\n')

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="licencas-${clientSlug}.csv"`,
    },
  })
}
