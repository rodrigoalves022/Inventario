import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import PDFDocument from 'pdfkit'
import { DEFAULT_ALERT_SETTINGS, deriveInventoryIssues, getEffectiveDeviceStatus } from '@/lib/inventory-alerts'
import { isServerOperatingSystem } from '@/lib/device-classification'
import { parseSoftwareBlacklistMetadata } from '@/lib/alert-rules'

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
  /** Sprint 13. Computador ou servidor, via isServerOperatingSystem (mesmo
   * helper que ja diferencia /computers de /servers em tenant-computers-table.tsx) —
   * classificacao derivada do sistema operacional coletado, nunca um campo
   * gravado separadamente. */
  deviceType: 'computador' | 'servidor'
  /** Sprint 13. Espelha SecurityPosture.antivirusAtualizado — null quando nao apurado. */
  antivirusAtualizado: boolean | null
  /**
   * Sprint 13. Agregacao por MAQUINA (pior caso) a partir de Disk.criptografia
   * de todos os discos do device: `true` so quando TODOS os discos com dado
   * conhecido ('on'/'off') estao 'on'; `false` quando qualquer um conhecido
   * esta 'off'; `null` quando nenhum disco tem dado apurado. Mesma regra de
   * "pior caso" ja usada por evaluateAlertMetric('bitlocker_missing') em
   * lib/alert-rules.ts (dispara se QUALQUER disco conhecido estiver 'off') —
   * aqui invertida para expressar "ativo em todos", nao "falta em algum".
   */
  bitlockerAtivo: boolean | null
  /** Sprint 13. Discos deste device com espacoLivreGb abaixo do limiar
   * (alertDiskThresholdGb) recebido por getDeviceReportRows — vazio quando
   * nenhum disco do device esta abaixo do limiar ou sem dado. */
  criticalDisks: Array<{ unidade: string | null; capacidadeGb: number | null; espacoLivreGb: number | null }>
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
  /** Sprint 13. Contagem de maquinas por tipo (isServerOperatingSystem). */
  computadores: number
  servidores: number
  /**
   * Sprint 13. Conformidade de seguranca ("Resumo Executivo" do PDF). Cada
   * percentual e calculado sobre o denominador de maquinas com dado APURADO
   * (nao sobre o total da frota) — mesma logica ja usada em toda a base para
   * nao confundir "nao apurado" com "desativado" (ex.: formatBoolCsv abaixo,
   * SecurityInfo). Uma frota com metade das maquinas sem coleta de seguranca
   * não deve fazer os 2 outros 50% carregarem sozinhos uma % artificialmente
   * baixa nem alta — o *KnownCount ao lado de cada percentual deixa a base
   * de calculo explicita para quem le o relatorio.
   */
  securityCompliance: {
    bitlockerActivePercent: string
    bitlockerKnownCount: number
    antivirusUpdatedPercent: string
    antivirusUpdatedKnownCount: number
    firewallActivePercent: string
    firewallKnownCount: number
  }
  /** Sprint 13. Discos criticos de TODAS as maquinas, achatados com hostname
   * — cada linha e um disco de DeviceReportRow.criticalDisks. */
  criticalDisks: Array<{
    hostname: string
    unidade: string | null
    capacidadeGb: number | null
    espacoLivreGb: number | null
  }>
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
 * Agregacao de BitLocker por MAQUINA a partir dos discos individuais — ver
 * doc do campo `bitlockerAtivo` em DeviceReportRow para a regra completa
 * ("pior caso": so conta como ativo se TODOS os discos com dado conhecido
 * estiverem 'on'). Funcao pura, testada isoladamente.
 */
export function computeRowBitlockerStatus(disks: Array<{ criptografia: string | null }>): boolean | null {
  const known = disks.filter((disk) => disk.criptografia === 'on' || disk.criptografia === 'off')
  if (known.length === 0) return null
  return known.every((disk) => disk.criptografia === 'on')
}

/**
 * Busca os dados-fonte do relatorio de inventario, ja escopados por tenant
 * pelo `where` recebido (getTenantDeviceWhere ou equivalente do portal).
 * `alertOfflineHours` (default do tenant se nao informado) alimenta
 * `getRowEffectiveStatus` — ver doc acima. `alertDiskThresholdGb` (Sprint 13,
 * default do tenant se nao informado) alimenta `criticalDisks` por device.
 */
export async function getDeviceReportRows(
  where: Prisma.DeviceWhereInput,
  alertOfflineHours: number = DEFAULT_ALERT_SETTINGS.alertOfflineHours,
  alertDiskThresholdGb: number = DEFAULT_ALERT_SETTINGS.alertDiskThresholdGb
): Promise<DeviceReportRow[]> {
  const devices = await prisma.device.findMany({
    where,
    orderBy: { hostname: 'asc' },
    include: {
      hardware: { select: { sistema: true, processador: true, ramTotalGb: true } },
      disks: { select: { unidade: true, capacidadeGb: true, espacoLivreGb: true, criptografia: true } },
      networks: { where: { isPrimary: true }, select: { ip: true }, take: 1 },
      security: { select: { antivirusAtivo: true, firewallAtivo: true, antivirusAtualizado: true } },
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
    const criticalDisks = device.disks
      .filter((disk) => disk.espacoLivreGb != null && disk.espacoLivreGb < alertDiskThresholdGb)
      .map((disk) => ({
        unidade: disk.unidade ?? null,
        capacidadeGb: disk.capacidadeGb ?? null,
        espacoLivreGb: disk.espacoLivreGb ?? null,
      }))

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
      deviceType: isServerOperatingSystem(device.hardware?.sistema) ? 'servidor' : 'computador',
      antivirusAtualizado: device.security?.antivirusAtualizado ?? null,
      bitlockerAtivo: computeRowBitlockerStatus(device.disks.map((disk) => ({ criptografia: disk.criptografia ?? null }))),
      criticalDisks,
    }
  })
}

/**
 * Historico de softwares nao autorizados detectados no tenant (Sprint 13,
 * relatorio executivo em PDF). NAO faz parte de DeviceReportRow (e' um
 * agregado POR TENANT via AlertEvent, nao por device) — consulta separada,
 * escopada por clientId (fail-closed, mesmo padrao de toda consulta de
 * tenant). Decisao de escopo: sem seletor de periodo (o usuario nao pediu
 * controle de data) — lista os `limit` mais recentes por firedAt desc, mesmo
 * padrao (take: 50) ja usado em app/app/[clientSlug]/alerts/page.tsx.
 */
export type BlacklistedSoftwareEvent = {
  hostname: string
  softwareNome: string
  softwareVersao: string | null
  softwareEditor: string | null
  firedAt: Date
  resolvedAt: Date | null
}

export async function getBlacklistedSoftwareHistory(
  clientId: string,
  limit = 50
): Promise<BlacklistedSoftwareEvent[]> {
  const events = await prisma.alertEvent.findMany({
    where: { clientId, metric: 'software_blacklisted' },
    orderBy: { firedAt: 'desc' },
    take: limit,
    select: {
      metadataJson: true,
      firedAt: true,
      resolvedAt: true,
      device: { select: { hostname: true } },
    },
  })

  const rows: BlacklistedSoftwareEvent[] = []
  for (const event of events) {
    const metadata = parseSoftwareBlacklistMetadata(event.metadataJson)
    if (!metadata) continue
    rows.push({
      hostname: event.device.hostname,
      softwareNome: metadata.softwareNome,
      softwareVersao: metadata.softwareVersao,
      softwareEditor: metadata.softwareEditor,
      firedAt: event.firedAt,
      resolvedAt: event.resolvedAt,
    })
  }
  return rows
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

  const computadores = rows.filter((row) => row.deviceType === 'computador').length
  const servidores = rows.filter((row) => row.deviceType === 'servidor').length

  const bitlocker = computeBooleanCompliance(rows.map((row) => row.bitlockerAtivo))
  const antivirusUpdated = computeBooleanCompliance(rows.map((row) => row.antivirusAtualizado))
  const firewall = computeBooleanCompliance(rows.map((row) => row.firewallAtivo))

  const criticalDisks = rows.flatMap((row) =>
    row.criticalDisks.map((disk) => ({ hostname: row.hostname, ...disk }))
  )

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
    computadores,
    servidores,
    securityCompliance: {
      bitlockerActivePercent: bitlocker.percent,
      bitlockerKnownCount: bitlocker.knownCount,
      antivirusUpdatedPercent: antivirusUpdated.percent,
      antivirusUpdatedKnownCount: antivirusUpdated.knownCount,
      firewallActivePercent: firewall.percent,
      firewallKnownCount: firewall.knownCount,
    },
    criticalDisks,
  }
}

/** Percentual "ativo" sobre o denominador de valores APURADOS (nao-null) —
 * ver doc de DeviceReportSummary.securityCompliance para o raciocinio. */
function computeBooleanCompliance(values: Array<boolean | null>) {
  const known = values.filter((value): value is boolean => value !== null)
  const activeCount = known.filter(Boolean).length
  const percent = known.length > 0 ? ((activeCount / known.length) * 100).toFixed(1) : '0.0'
  return { percent, knownCount: known.length, activeCount }
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
 * de maquinas paginada manualmente — pdfkit nao pagina tabelas sozinho.
 *
 * Sprint 13: visual "enterprise" (marca d'água de confidencialidade
 * vetorial — sem logotipo, `Client` nao tem campo de imagem/branding —,
 * data de emissão já existia) e 3 seções novas de conteúdo: Conformidade de
 * Segurança, Discos Críticos e Softwares Não Autorizados. `extras` é
 * opcional para não quebrar nenhum chamador que ainda não tenha a lista de
 * software (ex.: um teste que só verifica content-type/status). */
export function renderDeviceReportPdf(
  rows: DeviceReportRow[],
  summary: DeviceReportSummary,
  meta: { title: string; subtitle: string; generatedAt: Date },
  extras: { blacklistedSoftware?: BlacklistedSoftwareEvent[]; alertDiskThresholdGb?: number } = {}
): Promise<Buffer> {
  const blacklistedSoftware = extras.blacklistedSoftware ?? []
  const alertDiskThresholdGb = extras.alertDiskThresholdGb ?? DEFAULT_ALERT_SETTINGS.alertDiskThresholdGb

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Marca d'água "CONFIDENCIAL", vetorial (texto pdfkit rotacionado, baixa
    // opacidade) — Client não tem campo de logotipo (schema só tem `name`),
    // então o cabeçalho é só texto (título/subtítulo/data já existiam
    // abaixo). Redesenhada em toda página nova ('pageAdded' cobre tanto
    // doc.addPage() manual quanto a paginação automática do pdfkit quando um
    // doc.text() de fluxo livre estoura a margem inferior). doc.text() com
    // x/y explícitos move o cursor (doc.x/doc.y) para onde escreveu — por
    // isso o reset explícito ao fim, sempre para o topo da margem da página
    // atual, nunca preservando a posição anterior (que não faz sentido numa
    // página em branco).
    function drawConfidentialWatermark() {
      doc.save()
      doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] })
      doc.opacity(0.07).fontSize(60).fillColor('#000000')
      doc.text('CONFIDENCIAL', 0, doc.page.height / 2 - 30, { width: doc.page.width, align: 'center' })
      doc.restore()
      doc.opacity(1)
      doc.x = doc.page.margins.left
      doc.y = doc.page.margins.top
    }

    doc.on('pageAdded', drawConfidentialWatermark)
    drawConfidentialWatermark()

    doc.fontSize(18).fillColor('#000').text(meta.title)
    doc.fontSize(11).fillColor('#555').text(meta.subtitle)
    doc.fontSize(9).fillColor('#888').text(`Gerado em ${meta.generatedAt.toLocaleString('pt-BR')}`)
    doc.fontSize(8).fillColor('#b91c1c').text('CONFIDENCIAL — uso interno do cliente e do prestador de serviço')
    doc.moveDown(1)

    doc.fillColor('#000').fontSize(12).text('Resumo de Ativos')
    doc.fontSize(10).fillColor('#333')
    doc.text(`${summary.totalDevices} máquina(s) · ${summary.computadores} computador(es) · ${summary.servidores} servidor(es)`)
    doc.text(
      `${summary.online} online · ${summary.offline} offline · ${summary.warning} em atenção · disponibilidade ${summary.availabilityPercent}%`
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

    doc.fillColor('#000').fontSize(12).text('Conformidade de Segurança')
    doc.fontSize(10).fillColor('#333')
    doc.text(
      `BitLocker ativo em todos os discos: ${summary.securityCompliance.bitlockerActivePercent}% ` +
        `(${summary.securityCompliance.bitlockerKnownCount} máquina(s) com dado apurado de ${summary.totalDevices})`
    )
    doc.text(
      `Antivírus atualizado: ${summary.securityCompliance.antivirusUpdatedPercent}% ` +
        `(${summary.securityCompliance.antivirusUpdatedKnownCount} máquina(s) com dado apurado de ${summary.totalDevices})`
    )
    doc.text(
      `Firewall ativo: ${summary.securityCompliance.firewallActivePercent}% ` +
        `(${summary.securityCompliance.firewallKnownCount} máquina(s) com dado apurado de ${summary.totalDevices})`
    )
    doc.moveDown(1)

    doc.fillColor('#000').fontSize(12).text(`Resumo de Discos Críticos (abaixo de ${alertDiskThresholdGb} GB livres)`)
    doc.fontSize(9).fillColor('#333')
    if (summary.criticalDisks.length === 0) {
      doc.text('Nenhum disco abaixo do limiar configurado.')
    } else {
      for (const disk of summary.criticalDisks) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage()
        doc.text(
          `${disk.hostname} — ${disk.unidade ?? 'disco'}: ${disk.espacoLivreGb ?? '—'} GB livres de ${disk.capacidadeGb ?? '—'} GB`
        )
      }
    }
    doc.moveDown(1)

    doc.fillColor('#000').fontSize(12).text('Softwares Não Autorizados (mais recentes detectados)')
    doc.fontSize(9).fillColor('#333')
    if (blacklistedSoftware.length === 0) {
      doc.text('Nenhum software não autorizado detectado.')
    } else {
      for (const event of blacklistedSoftware) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage()
        const statusLabel = event.resolvedAt
          ? `resolvido em ${event.resolvedAt.toLocaleDateString('pt-BR')}`
          : 'em aberto'
        const versaoLabel = event.softwareVersao ? ` (versão ${event.softwareVersao})` : ''
        const editorLabel = event.softwareEditor ? `, editor: ${event.softwareEditor}` : ''
        doc.text(
          `${event.hostname} — ${event.softwareNome}${versaoLabel}${editorLabel} — detectado em ${event.firedAt.toLocaleDateString('pt-BR')} (${statusLabel})`
        )
      }
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
