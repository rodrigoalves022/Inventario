import prisma from '@/lib/prisma'
import { getLowestDiskFreeGb, type InventoryAlertSettings } from '@/lib/inventory-alerts'
import { sendAlertWebhook } from '@/lib/alert-webhook'

/**
 * Sprint 9, item A.1. Fecha o gap do caminho reativo existente
 * (app/api/agent/checkin/route.ts): aquele so reage quando o PROPRIO
 * dispositivo faz check-in, entao uma maquina que simplesmente PARA de
 * reportar nunca dispara nada — nenhuma nova requisicao re-executa o codigo
 * depois do ultimo check-in dela. Esta funcao roda como piggyback, varrendo
 * TODOS os dispositivos do cliente sempre que QUALQUER UM deles faz
 * check-in (nao ha cron/job agendado neste projeto — ver RNF007).
 *
 * Limite conhecido e aceito (nao e' bug): um cliente com um unico
 * dispositivo, ou cuja frota inteira fica muda ao mesmo tempo, nunca aciona
 * esta varredura — documentado em
 * components/tenant-alert-settings-form.tsx.
 */
export const AVAILABILITY_METRICS = ['device_offline', 'low_disk'] as const
export type AvailabilityMetric = (typeof AVAILABILITY_METRICS)[number]

type DeviceForAvailability = {
  id: string
  hostname: string
  updatedAt: Date
  logs: Array<{ coletadoEm: Date }>
  disks: Array<{ espacoLivreGb: number | null }>
}

export type ReconcileAvailabilityParams = {
  clientId: string
  clientName: string | null
  clientSlug: string | null
  settings: InventoryAlertSettings
  /** Dispositivo que acabou de fazer check-in nesta requisicao — o disco dele
   * ja e coberto pelo caminho reativo existente (baseado em warningIssues),
   * entao esta funcao nao duplica a checagem de low_disk para ele. O
   * device_offline dele continua sendo avaliado normalmente (nunca dispara,
   * ja que acabou de coletar, mas resolve um evento aberto anterior caso a
   * maquina tenha voltado a reportar). */
  checkedInDeviceId: string
  now?: Date
}

function eventKey(deviceId: string, metric: AvailabilityMetric) {
  return `${deviceId}:${metric}`
}

export async function reconcileAvailabilityEvents(params: ReconcileAvailabilityParams): Promise<void> {
  const { clientId, clientName, clientSlug, settings, checkedInDeviceId } = params
  if (!settings.alertsEnabled) return

  const now = params.now ?? new Date()

  const devices: DeviceForAvailability[] = await prisma.device.findMany({
    where: { clientId },
    select: {
      id: true,
      hostname: true,
      updatedAt: true,
      logs: { orderBy: { coletadoEm: 'desc' }, take: 1, select: { coletadoEm: true } },
      disks: { select: { espacoLivreGb: true } },
    },
  })

  if (devices.length === 0) return

  const openEvents = await prisma.alertEvent.findMany({
    where: {
      clientId,
      resolvedAt: null,
      ruleId: null,
      metric: { in: [...AVAILABILITY_METRICS] },
    },
  })
  const openByKey = new Map(openEvents.map((event) => [eventKey(event.deviceId, event.metric as AvailabilityMetric), event]))

  const canSendWebhook = Boolean(settings.alertWebhookEnabled && settings.alertWebhookUrl)

  async function openEvent(device: DeviceForAvailability, metric: AvailabilityMetric, message: string) {
    await prisma.alertEvent.create({
      data: {
        clientId,
        deviceId: device.id,
        ruleId: null,
        metric,
        severity: 'critical',
        message,
      },
    })

    if (canSendWebhook) {
      sendAlertWebhook(settings.alertWebhookUrl as string, {
        event: metric === 'device_offline' ? 'device.offline' : 'device.low_disk',
        tenant: { id: clientId, name: clientName, slug: clientSlug },
        device: { id: device.id, hostname: device.hostname },
        metric,
        message,
        collectedAt: now.toISOString(),
      })
    }
  }

  async function resolveEvent(device: DeviceForAvailability, metric: AvailabilityMetric, eventId: string, message: string) {
    await prisma.alertEvent.update({
      where: { id: eventId },
      data: { resolvedAt: now },
    })

    if (canSendWebhook) {
      sendAlertWebhook(settings.alertWebhookUrl as string, {
        event: metric === 'device_offline' ? 'device.online' : 'device.disk_ok',
        tenant: { id: clientId, name: clientName, slug: clientSlug },
        device: { id: device.id, hostname: device.hostname },
        metric,
        message,
        collectedAt: now.toISOString(),
      })
    }
  }

  for (const device of devices) {
    const lastCollectionAt = device.logs[0]?.coletadoEm ?? device.updatedAt
    const ageHours = Math.floor((now.getTime() - lastCollectionAt.getTime()) / 36e5)
    const isOffline = ageHours >= settings.alertOfflineHours

    const openOffline = openByKey.get(eventKey(device.id, 'device_offline'))
    if (isOffline && !openOffline) {
      await openEvent(
        device,
        'device_offline',
        `Sem coleta há ${ageHours}h (limite: ${settings.alertOfflineHours}h).`
      )
    } else if (!isOffline && openOffline) {
      await resolveEvent(
        device,
        'device_offline',
        openOffline.id,
        `Voltou a coletar (última coleta há ${ageHours}h).`
      )
    }

    // O dispositivo que acabou de fazer check-in ja e' coberto pelo caminho
    // reativo (warningIssues, na propria rota de check-in) — evita duplicar
    // a logica de deteccao de disco baixo para ele aqui.
    if (device.id === checkedInDeviceId) continue

    const lowestDiskFreeGb = getLowestDiskFreeGb(device.disks)
    const isLowDisk = lowestDiskFreeGb !== null && lowestDiskFreeGb < settings.alertDiskThresholdGb

    const openDisk = openByKey.get(eventKey(device.id, 'low_disk'))
    if (isLowDisk && !openDisk) {
      await openEvent(
        device,
        'low_disk',
        `Menor disco com ${lowestDiskFreeGb} GB livres (limite: ${settings.alertDiskThresholdGb} GB).`
      )
    } else if (!isLowDisk && openDisk) {
      await resolveEvent(device, 'low_disk', openDisk.id, 'Espaço em disco voltou ao normal.')
    }
  }
}
