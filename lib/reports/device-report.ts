import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import PDFDocument from 'pdfkit'
import { DEFAULT_ALERT_SETTINGS, deriveInventoryIssues, getEffectiveDeviceStatus } from '@/lib/inventory-alerts'

export type DeviceReportRow = {
  hostname: string
  status: string
  ip: string | null
  sistema: string | null
  processador: string | null
  ramTotalGb: number | null
  discoCapacidadeGb: number | null
  discoLivreGb: number | null
  antivirusAtivo: boolean | null
  firewallAtivo: boolean | null
  ultimaColeta: Date | null
  etiquetaPatrimonio: string | null
  localizacao: string | null
  responsavel: string | null
}

export type UsageBucket = { label: string; count: number }

export type DeviceReportSummary = {
  totalDevices: number
  online: number
  offline: number
  warning: number
  availabilityPercent: string
  osDistribution: Array<{ name: string; value: number }>
  /** Buckets por maquina, nao um blend: uma "% usado" unica misturando
   * discos de tamanhos bem diferentes nao representa nenhuma maquina real. */
  ramDistribution: UsageBucket[]
  diskUsageDistribution: UsageBucket[]
  /** Somas brutas da frota — informativas, sem alegar uma proporcao "usada". */
  storageCapacityGb: number
  storageFreeGb: number
  storageUsedGb: number
}

function summarizeOs(osName: string) {
  if (osName.includes('Windows 11')) return 'Windows 11'
  if (osName.includes('Windows 10')) return 'Windows 10'
  if (osName.includes('Server')) return 'Windows Server'
  if (osName.toLowerCase().includes('linux')) return 'Linux'
  return osName
}

/**
 * Agrupa por capacidade exata (11 GB, 18 GB, ...), nao por faixa — um parque
 * pequeno com valores bem diferentes entre si (comum fora de compra em lote)
 * fica ilegivel em faixas largas tipo "9-16 GB". Continua "conta maquina",
 * nunca soma: so troca a chave de agrupamento de faixa pra valor real.
 */
function bucketRamByExactValue(rows: Pick<DeviceReportRow, 'ramTotalGb'>[]): UsageBucket[] {
  const ramMap = new Map<number, number>()
  for (const row of rows) {
    if (row.ramTotalGb == null) continue
    ramMap.set(row.ramTotalGb, (ramMap.get(row.ramTotalGb) ?? 0) + 1)
  }
  return Array.from(ramMap.entries())
    .sort(([left], [right]) => left - right)
    .map(([gb, count]) => ({ label: `${gb} GB`, count }))
}

const DISK_USAGE_BUCKET_ORDER = ['Até 50% usado', '50–80% usado', '80–95% usado', '95%+ usado (crítico)']

function bucketDiskUsage(usedPercent: number) {
  if (usedPercent < 50) return 'Até 50% usado'
  if (usedPercent < 80) return '50–80% usado'
  if (usedPercent < 95) return '80–95% usado'
  return '95%+ usado (crítico)'
}

/**
 * Status EFETIVO de uma linha do relatorio, via `deriveInventoryIssues` +
 * `getEffectiveDeviceStatus` — as mesmas funcoes que o resto do app usa
 * (dashboard, /computers) — em vez do `device.status` bruto do banco, que
 * so recebe 'online'/'warning' no checkin e nunca 'offline' (RN010). So a
 * issue 'stale_collection' e considerada aqui (sem ram/disco), porque essa
 * e a unica dimensao que falta no `status` bruto; low_disk/low_ram ja vem
 * refletidos no `status` gravado no checkin. Funcao pura (sem Prisma) para
 * ser testada isoladamente e reaproveitada por `getDeviceReportRows`.
 */
export function getRowEffectiveStatus(
  row: { status: string; ultimaColeta: Date | string | null; updatedAt?: Date | string | null },
  alertOfflineHours: number = DEFAULT_ALERT_SETTINGS.alertOfflineHours
): string {
  // `updatedAt` e o fallback de `deriveInventoryIssues` quando nunca houve
  // CollectionLog (ultimaColeta null) — sem ele, um dispositivo "nunca
  // coletado" nunca seria marcado como stale/offline (mesmo fallback usado
  // pelo dashboard/computers via device.updatedAt).
  const issues = deriveInventoryIssues(
    { lastCollectionAt: row.ultimaColeta, updatedAt: row.updatedAt ?? null },
    { ...DEFAULT_ALERT_SETTINGS, alertOfflineHours }
  )
  return getEffectiveDeviceStatus(row.status, issues)
}

/**
 * Busca os dados-fonte do relatorio de inventario, ja escopados por tenant
 * pelo `where` recebido (getTenantDeviceWhere ou equivalente do portal).
 * `alertOfflineHours` (default do tenant se nao informado) alimenta
 * `getRowEffectiveStatus` — ver doc acima.
 */
export async function getDeviceReportRows(
  where: Prisma.DeviceWhereInput,
  alertOfflineHours: number = DEFAULT_ALERT_SETTINGS.alertOfflineHours
): Promise<DeviceReportRow[]> {
  const devices = await prisma.device.findMany({
    where,
    orderBy: { hostname: 'asc' },
    include: {
      hardware: { select: { sistema: true, processador: true, ramTotalGb: true } },
      disks: { select: { capacidadeGb: true, espacoLivreGb: true } },
      networks: { where: { isPrimary: true }, select: { ip: true }, take: 1 },
      security: { select: { antivirusAtivo: true, firewallAtivo: true } },
      assetRecord: { select: { etiqueta: true, localizacao: true, responsavel: true } },
      logs: { orderBy: { coletadoEm: 'desc' }, take: 1, select: { coletadoEm: true } },
    },
  })

  return devices.map((device) => {
    const capacidadeGb = device.disks.reduce((sum, disk) => sum + (disk.capacidadeGb ?? 0), 0)
    const livreGb = device.disks.reduce((sum, disk) => sum + (disk.espacoLivreGb ?? 0), 0)
    const ultimaColeta = device.logs[0]?.coletadoEm ?? null
    const effectiveStatus = getRowEffectiveStatus(
      { status: device.status, ultimaColeta, updatedAt: device.updatedAt },
      alertOfflineHours
    )

    return {
      hostname: device.hostname,
      status: effectiveStatus,
      ip: device.networks[0]?.ip ?? null,
      sistema: device.hardware?.sistema ?? null,
      processador: device.hardware?.processador ?? null,
      ramTotalGb: device.hardware?.ramTotalGb ?? null,
      discoCapacidadeGb: device.disks.length > 0 ? capacidadeGb : null,
      discoLivreGb: device.disks.length > 0 ? livreGb : null,
      antivirusAtivo: device.security?.antivirusAtivo ?? null,
      firewallAtivo: device.security?.firewallAtivo ?? null,
      ultimaColeta,
      etiquetaPatrimonio: device.assetRecord?.etiqueta ?? null,
      localizacao: device.assetRecord?.localizacao ?? null,
      responsavel: device.assetRecord?.responsavel ?? null,
    }
  })
}

export function buildDeviceReportSummary(rows: DeviceReportRow[]): DeviceReportSummary {
  const totalDevices = rows.length
  const online = rows.filter((row) => row.status === 'online').length
  const offline = rows.filter((row) => row.status === 'offline').length
  const warning = rows.filter((row) => row.status === 'warning').length
  const availabilityPercent = totalDevices > 0 ? ((online / totalDevices) * 100).toFixed(1) : '0.0'

  const osMap = new Map<string, number>()
  for (const row of rows) {
    if (!row.sistema) continue
    const key = summarizeOs(row.sistema)
    osMap.set(key, (osMap.get(key) ?? 0) + 1)
  }
  const osDistribution = Array.from(osMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)

  const ramDistribution = bucketRamByExactValue(rows)

  // Bucket por maquina (cada uma com sua propria % de uso), nao um blend de
  // todos os discos somados — ver nota no tipo DeviceReportSummary.
  const diskUsageMap = new Map<string, number>()
  for (const row of rows) {
    if (row.discoCapacidadeGb == null || row.discoCapacidadeGb <= 0 || row.discoLivreGb == null) continue
    const usedPercent = Math.round(((row.discoCapacidadeGb - row.discoLivreGb) / row.discoCapacidadeGb) * 100)
    const key = bucketDiskUsage(usedPercent)
    diskUsageMap.set(key, (diskUsageMap.get(key) ?? 0) + 1)
  }
  const diskUsageDistribution = DISK_USAGE_BUCKET_ORDER.map((label) => ({
    label,
    count: diskUsageMap.get(label) ?? 0,
  }))

  const storageCapacityGb = rows.reduce((sum, row) => sum + (row.discoCapacidadeGb ?? 0), 0)
  const storageFreeGb = rows.reduce((sum, row) => sum + (row.discoLivreGb ?? 0), 0)
  const storageUsedGb = Math.max(storageCapacityGb - storageFreeGb, 0)

  return {
    totalDevices,
    online,
    offline,
    warning,
    availabilityPercent,
    osDistribution,
    ramDistribution,
    diskUsageDistribution,
    storageCapacityGb,
    storageFreeGb,
    storageUsedGb,
  }
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatBoolCsv(value: boolean | null) {
  if (value === null) return 'não apurado'
  return value ? 'sim' : 'não'
}

const CSV_HEADERS = [
  'Hostname',
  'Status',
  'IP',
  'Sistema operacional',
  'Processador',
  'RAM total (GB)',
  'Disco total (GB)',
  'Disco livre (GB)',
  'Antivírus ativo',
  'Firewall ativo',
  'Última coleta',
  'Etiqueta de patrimônio',
  'Localização',
  'Responsável',
]

export function renderDeviceReportCsv(rows: DeviceReportRow[]): string {
  const lines = [CSV_HEADERS.join(',')]

  for (const row of rows) {
    const fields = [
      row.hostname,
      row.status,
      row.ip ?? '',
      row.sistema ?? '',
      row.processador ?? '',
      row.ramTotalGb != null ? String(row.ramTotalGb) : '',
      row.discoCapacidadeGb != null ? String(row.discoCapacidadeGb) : '',
      row.discoLivreGb != null ? String(row.discoLivreGb) : '',
      formatBoolCsv(row.antivirusAtivo),
      formatBoolCsv(row.firewallAtivo),
      row.ultimaColeta ? row.ultimaColeta.toISOString() : '',
      row.etiquetaPatrimonio ?? '',
      row.localizacao ?? '',
      row.responsavel ?? '',
    ]
    lines.push(fields.map((field) => escapeCsvField(field)).join(','))
  }

  // BOM explicito via code point (nao um caractere literal no arquivo, pra
  // nao depender de encoding do editor): Excel no Windows so reconhece UTF-8
  // sem ambiguidade com esse prefixo, senao acentos viram lixo ao abrir direto.
  const BOM = String.fromCharCode(0xfeff)
  return BOM + lines.join('\r\n')
}

type PdfColumn = {
  key: 'hostname' | 'status' | 'ip' | 'sistema' | 'ramTotalGb' | 'disco' | 'ultimaColeta'
  label: string
  width: number
}

const PDF_COLUMNS: PdfColumn[] = [
  { key: 'hostname', label: 'Hostname', width: 95 },
  { key: 'status', label: 'Status', width: 50 },
  { key: 'ip', label: 'IP', width: 70 },
  { key: 'sistema', label: 'Sistema', width: 105 },
  { key: 'ramTotalGb', label: 'RAM', width: 40 },
  { key: 'disco', label: 'Disco', width: 75 },
  { key: 'ultimaColeta', label: 'Última coleta', width: 80 },
]

function pdfRowValues(row: DeviceReportRow): Record<PdfColumn['key'], string> {
  const discoUsado =
    row.discoCapacidadeGb != null ? Math.max(row.discoCapacidadeGb - (row.discoLivreGb ?? 0), 0) : null
  return {
    hostname: row.hostname,
    status: row.status,
    ip: row.ip ?? '—',
    sistema: row.sistema ?? '—',
    ramTotalGb: row.ramTotalGb != null ? `${row.ramTotalGb}GB` : '—',
    disco: discoUsado != null ? `${discoUsado}/${row.discoCapacidadeGb}GB` : '—',
    ultimaColeta: row.ultimaColeta ? row.ultimaColeta.toLocaleDateString('pt-BR') : '—',
  }
}

/** Gera o mesmo resumo exibido na tela de relatorios, em PDF, com uma tabela
 * de maquinas paginada manualmente — pdfkit nao pagina tabelas sozinho. */
export function renderDeviceReportPdf(
  rows: DeviceReportRow[],
  summary: DeviceReportSummary,
  meta: { title: string; subtitle: string; generatedAt: Date }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(18).fillColor('#000').text(meta.title)
    doc.fontSize(11).fillColor('#555').text(meta.subtitle)
    doc.fontSize(9).fillColor('#888').text(`Gerado em ${meta.generatedAt.toLocaleString('pt-BR')}`)
    doc.moveDown(1)

    doc.fillColor('#000').fontSize(12).text('Resumo')
    doc.fontSize(10).fillColor('#333')
    doc.text(
      `${summary.totalDevices} máquina(s) · ${summary.online} online · ${summary.offline} offline · ${summary.warning} em atenção · disponibilidade ${summary.availabilityPercent}%`
    )
    if (summary.storageCapacityGb > 0) {
      doc.text(
        `Armazenamento (soma da frota): ${summary.storageFreeGb} GB livres de ${summary.storageCapacityGb} GB — total informativo, não uma % de uso (máquinas com discos de tamanhos diferentes não se resumem a um único número)`
      )
    }
    const diskBucketsWithData = summary.diskUsageDistribution.filter((bucket) => bucket.count > 0)
    if (diskBucketsWithData.length > 0) {
      doc.text('Uso de disco por máquina: ' + diskBucketsWithData.map((b) => `${b.label} (${b.count})`).join(', '))
    }
    if (summary.osDistribution.length > 0) {
      doc.text(
        'Sistemas operacionais: ' +
          summary.osDistribution.map((item) => `${item.name} (${item.value})`).join(', ')
      )
    }
    doc.moveDown(1)

    const tableWidth = PDF_COLUMNS.reduce((sum, col) => sum + col.width, 0)
    const startX = doc.page.margins.left
    const rowHeight = 16
    let y = doc.y

    function drawHeader() {
      doc.rect(startX, y, tableWidth, rowHeight + 2).fill('#333')
      doc.fillColor('#fff').fontSize(9)
      let x = startX
      for (const col of PDF_COLUMNS) {
        doc.text(col.label, x + 3, y + 5, { width: col.width - 4 })
        x += col.width
      }
      y += rowHeight + 2
      doc.fillColor('#000')
    }

    drawHeader()
    doc.fontSize(8)

    if (rows.length === 0) {
      doc.fillColor('#666').text('Nenhuma máquina reportada neste tenant.', startX, y + 4)
    }

    rows.forEach((row, index) => {
      if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
        doc.addPage()
        y = doc.page.margins.top
        drawHeader()
        doc.fontSize(8)
      }

      if (index % 2 === 1) {
        doc.rect(startX, y, tableWidth, rowHeight).fill('#f2f2f2')
      }
      doc.fillColor('#000')

      const values = pdfRowValues(row)
      let x = startX
      for (const col of PDF_COLUMNS) {
        doc.text(values[col.key], x + 3, y + 4, { width: col.width - 4, ellipsis: true })
        x += col.width
      }
      y += rowHeight
    })

    doc.end()
  })
}
