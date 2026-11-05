import prisma from '@/lib/prisma'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

export type LicenseStatus = 'COMPLIANT' | 'OVERUSED' | 'UNUSED' | 'EXPIRING_SOON' | 'EXPIRED'

export const LICENSE_STATUS_LABELS: Record<LicenseStatus, string> = {
  COMPLIANT: 'Em conformidade',
  OVERUSED: 'Excedida (Não conforme)',
  UNUSED: 'Ociosa (Sem uso)',
  EXPIRING_SOON: 'Vencendo em breve',
  EXPIRED: 'Expirada',
}

export const LICENSE_STATUS_BADGE_CLASS: Record<LicenseStatus, string> = {
  COMPLIANT: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  OVERUSED: 'border-destructive/40 bg-destructive/10 text-destructive',
  UNUSED: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
  EXPIRING_SOON: 'border-warning/40 bg-warning/10 text-warning',
  EXPIRED: 'border-destructive/40 bg-destructive/10 text-destructive',
}

export type SoftwareLicenseRecord = {
  id: string
  clientId: string
  softwareName: string
  licenseKey: string | null
  seatsPurchased: number
  contractRef: string | null
  supplier: string | null
  cost: number | null
  expiresAt: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type InstalledSoftwareRecord = {
  deviceId: string
  hostname: string
  nome: string
  versao: string | null
}

export type ReconciledLicenseItem = {
  id: string
  softwareName: string
  licenseKey: string | null
  seatsPurchased: number
  seatsInstalled: number
  seatsAvailable: number
  contractRef: string | null
  supplier: string | null
  cost: number | null
  expiresAt: string | null
  isExpiringSoon: boolean
  isExpired: boolean
  status: LicenseStatus
  notes: string | null
  installedDevices: Array<{
    deviceId: string
    hostname: string
    version: string | null
  }>
}

export type LicenseSummary = {
  totalPurchased: number
  totalInstalled: number
  compliantCount: number
  overusedCount: number
  unusedCount: number
  expiringCount: number
  expiredCount: number
  totalCost: number
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function calculateLicenseStatus({
  seatsPurchased,
  seatsInstalled,
  expiresAt,
  now = new Date(),
}: {
  seatsPurchased: number
  seatsInstalled: number
  expiresAt: Date | null
  now?: Date
}): { status: LicenseStatus; isExpiringSoon: boolean; isExpired: boolean } {
  const nowMs = now.getTime()
  const expMs = expiresAt ? expiresAt.getTime() : null

  const isExpired = expMs != null && expMs < nowMs
  const isExpiringSoon = expMs != null && !isExpired && expMs - nowMs <= THIRTY_DAYS_MS

  if (isExpired) {
    return { status: 'EXPIRED', isExpiringSoon: false, isExpired: true }
  }

  if (seatsInstalled > seatsPurchased) {
    return { status: 'OVERUSED', isExpiringSoon, isExpired: false }
  }

  if (seatsInstalled === 0) {
    return { status: 'UNUSED', isExpiringSoon, isExpired: false }
  }

  if (isExpiringSoon) {
    return { status: 'EXPIRING_SOON', isExpiringSoon: true, isExpired: false }
  }

  return { status: 'COMPLIANT', isExpiringSoon: false, isExpired: false }
}

/**
 * Cruza a lista de licenças adquiridas com a lista de softwares instalados nas máquinas.
 * Garante que múltiplos registros do mesmo software na mesma máquina contem apenas 1 instalação.
 */
export function reconcileLicenses({
  licenses,
  installedSoftwares,
  now = new Date(),
}: {
  licenses: SoftwareLicenseRecord[]
  installedSoftwares: InstalledSoftwareRecord[]
  now?: Date
}): {
  items: ReconciledLicenseItem[]
  summary: LicenseSummary
} {
  const items: ReconciledLicenseItem[] = licenses.map((lic) => {
    const licTarget = lic.softwareName.trim().toLowerCase()

    // Encontra instalações que batem com o nome da licença
    const matchingInstallations = installedSoftwares.filter((inst) => {
      const instName = inst.nome.trim().toLowerCase()
      return instName === licTarget || instName.includes(licTarget) || licTarget.includes(instName)
    })

    // Deduplica por deviceId (1 licença por máquina física)
    const deviceMap = new Map<string, { deviceId: string; hostname: string; version: string | null }>()
    for (const inst of matchingInstallations) {
      if (!deviceMap.has(inst.deviceId)) {
        deviceMap.set(inst.deviceId, {
          deviceId: inst.deviceId,
          hostname: inst.hostname,
          version: inst.versao,
        })
      }
    }

    const installedDevices = Array.from(deviceMap.values()).sort((a, b) => a.hostname.localeCompare(b.hostname))
    const seatsInstalled = installedDevices.length
    const seatsAvailable = lic.seatsPurchased - seatsInstalled

    const { status, isExpiringSoon, isExpired } = calculateLicenseStatus({
      seatsPurchased: lic.seatsPurchased,
      seatsInstalled,
      expiresAt: lic.expiresAt,
      now,
    })

    return {
      id: lic.id,
      softwareName: lic.softwareName,
      licenseKey: lic.licenseKey,
      seatsPurchased: lic.seatsPurchased,
      seatsInstalled,
      seatsAvailable,
      contractRef: lic.contractRef,
      supplier: lic.supplier,
      cost: lic.cost,
      expiresAt: lic.expiresAt ? lic.expiresAt.toISOString() : null,
      isExpiringSoon,
      isExpired,
      status,
      notes: lic.notes,
      installedDevices,
    }
  })

  // Ordena por criticidade: OVERUSED > EXPIRED > EXPIRING_SOON > COMPLIANT > UNUSED
  const priorityOrder: Record<LicenseStatus, number> = {
    OVERUSED: 0,
    EXPIRED: 1,
    EXPIRING_SOON: 2,
    COMPLIANT: 3,
    UNUSED: 4,
  }

  items.sort((a, b) => {
    const pDiff = priorityOrder[a.status] - priorityOrder[b.status]
    if (pDiff !== 0) return pDiff
    return a.softwareName.localeCompare(b.softwareName)
  })

  const summary: LicenseSummary = {
    totalPurchased: items.reduce((acc, i) => acc + i.seatsPurchased, 0),
    totalInstalled: items.reduce((acc, i) => acc + i.seatsInstalled, 0),
    compliantCount: items.filter((i) => i.status === 'COMPLIANT').length,
    overusedCount: items.filter((i) => i.status === 'OVERUSED').length,
    unusedCount: items.filter((i) => i.status === 'UNUSED').length,
    expiringCount: items.filter((i) => i.status === 'EXPIRING_SOON').length,
    expiredCount: items.filter((i) => i.status === 'EXPIRED').length,
    totalCost: items.reduce((acc, i) => acc + (i.cost ?? 0), 0),
  }

  return { items, summary }
}

/**
 * Consulta as licenças e os softwares instalados de um cliente e devolve a reconciliação completa.
 */
export async function getTenantReconciledLicenses(clientSlug: string, clientId: string) {
  const [licenses, softwareRows] = await Promise.all([
    prisma.softwareLicense.findMany({
      where: { clientId },
      orderBy: { softwareName: 'asc' },
    }),
    prisma.software.findMany({
      where: {
        device: getTenantDeviceWhere(clientSlug),
      },
      select: {
        deviceId: true,
        nome: true,
        versao: true,
        device: {
          select: {
            hostname: true,
          },
        },
      },
    }),
  ])

  const installedSoftwares: InstalledSoftwareRecord[] = softwareRows.map((s) => ({
    deviceId: s.deviceId,
    hostname: s.device?.hostname ?? 'Desconhecido',
    nome: s.nome,
    versao: s.versao,
  }))

  return reconcileLicenses({ licenses, installedSoftwares })
}
