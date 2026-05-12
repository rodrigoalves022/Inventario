import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateAgentApiKey, authErrorResponse } from '@/lib/auth'
import { getCurrentServerUrl } from '@/lib/server-url'
import { deriveInventoryIssues, getWarningTransitionIssues } from '@/lib/inventory-alerts'
import { getTenantAlertSettingsByClientId } from '@/lib/tenant-alert-settings'
import { agentCheckinSchema } from '@/lib/schemas/agent-checkin'

const checkinSchema = agentCheckinSchema

export async function POST(req: NextRequest) {
  const auth = await validateAgentApiKey(req)
  if (!auth.ok) return authErrorResponse(auth)

  const ipOrigem = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'desconhecido'

  try {
    const rawBody = await req.json().catch(() => null)

    if (!rawBody) {
      void prisma.agentCheckLog
        .create({
          data: {
            agentAuthId: auth.agentAuth.id,
            deviceId: null,
            ipOrigem,
            status: 'invalid_json',
            detailsJson: null,
          },
        })
        .catch(() => null)

      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }
    const parsed = checkinSchema.safeParse(rawBody)

    if (!parsed.success) {
      void prisma.agentCheckLog
        .create({
          data: {
            agentAuthId: auth.agentAuth.id,
            deviceId: null,
            ipOrigem,
            status: 'invalid_payload',
            detailsJson: JSON.stringify(parsed.error.format()).slice(0, 20_000),
          },
        })
        .catch(() => null)

      return NextResponse.json(
        { error: 'Payload inválido ou excede o limite de recursos.', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const body = parsed.data
    const { hostname } = body
    const previousDevice = await prisma.device.findUnique({
      where: { agentAuthId: auth.agentAuth.id },
      select: { id: true, status: true },
    })
    const alertSettings = await getTenantAlertSettingsByClientId(auth.agentAuth.clientId)
    const warningIssues = alertSettings?.alertsEnabled
      ? getWarningTransitionIssues(
          deriveInventoryIssues(
            {
              hardware: { ramTotalGb: body.ramTotalGb },
              disks: body.discos,
            },
            alertSettings
          )
        )
      : []
    const nextStatus = warningIssues.length > 0 ? 'warning' : 'online'

    const device = await prisma.device.upsert({
      where: { agentAuthId: auth.agentAuth.id },
      create: {
        hostname,
        agentAuthId: auth.agentAuth.id,
        serial: body.serial,
        fabricante: body.fabricante,
        modelo: body.modelo,
        dominio: body.dominio,
        usuario: body.usuario,
        status: nextStatus,
      },
      update: {
        hostname,
        serial: body.serial,
        fabricante: body.fabricante,
        modelo: body.modelo,
        dominio: body.dominio,
        usuario: body.usuario,
        status: nextStatus,
        updatedAt: new Date(),
      },
    })

    if (body.sistema || body.processador || body.ramTotalGb) {
      await prisma.hardware.upsert({
        where: { deviceId: device.id },
        create: {
          deviceId: device.id,
          sistema: body.sistema,
          versaoSO: body.versaoSO,
          processador: body.processador,
          ramTotalGb: body.ramTotalGb,
          slot1: body.slot1,
          slot2: body.slot2,
          slot3: body.slot3,
          slot4: body.slot4,
          placaMae: body.placaMae,
          tipoArmazenamento: body.tipoArmazenamento,
        },
        update: {
          sistema: body.sistema,
          versaoSO: body.versaoSO,
          processador: body.processador,
          ramTotalGb: body.ramTotalGb,
          slot1: body.slot1,
          slot2: body.slot2,
          slot3: body.slot3,
          slot4: body.slot4,
          placaMae: body.placaMae,
          tipoArmazenamento: body.tipoArmazenamento,
        },
      })
    }

    if (body.redes && body.redes.length > 0) {
      await prisma.network.deleteMany({ where: { deviceId: device.id } })
      await prisma.network.createMany({
        data: body.redes.map((network) => ({
          deviceId: device.id,
          ip: network.ip,
          mac: network.mac,
          gateway: network.gateway,
          dns: network.dns,
          dhcp: network.dhcp ?? true,
          isPrimary: network.isPrimary ?? false,
        })),
      })
    }

    if (body.discos && body.discos.length > 0) {
      await prisma.disk.deleteMany({ where: { deviceId: device.id } })
      await prisma.disk.createMany({
        data: body.discos.map((disk) => ({
          deviceId: device.id,
          unidade: disk.unidade,
          modelo: disk.modelo,
          tipo: disk.tipo,
          capacidadeGb: disk.capacidadeGb,
          espacoLivreGb: disk.espacoLivreGb,
        })),
      })
    }

    if (body.software && body.software.length > 0) {
      await prisma.software.deleteMany({ where: { deviceId: device.id } })
      await prisma.software.createMany({
        data: body.software.map((software) => ({
          deviceId: device.id,
          nome: software.nome,
          versao: software.versao,
          editor: software.editor,
          installadoEm: software.installadoEm ? new Date(software.installadoEm) : null,
        })),
      })
    }

    const clientLabel = auth.agentAuth.clientName ? ` do cliente "${auth.agentAuth.clientName}"` : ''
    await prisma.collectionLog.create({
      data: {
        deviceId: device.id,
        ipOrigem,
        status: 'success',
        mensagem: `Checkin via agente v${body.agentVersion || '?'} "${auth.agentAuth.name}"${clientLabel}`,
      },
    })

    const shouldSendWebhook =
      alertSettings?.alertsEnabled &&
      alertSettings.alertWebhookEnabled &&
      alertSettings.alertWebhookUrl &&
      previousDevice &&
      previousDevice.status !== nextStatus &&
      (previousDevice.status === 'warning' || nextStatus === 'warning')

    if (shouldSendWebhook) {
      void fetch(alertSettings.alertWebhookUrl as string, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: nextStatus === 'warning' ? 'device.warning' : 'device.recovered',
          tenant: {
            id: auth.agentAuth.clientId,
            name: auth.agentAuth.clientName,
            slug: auth.agentAuth.clientSlug,
          },
          device: {
            id: device.id,
            hostname: device.hostname,
            status: nextStatus,
          },
          issues: warningIssues,
          collectedAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(4000),
      }).catch((error) => {
        console.error('[alerts/webhook] Falha ao enviar webhook:', error)
      })
    }

    const LATEST_AGENT_VERSION = "1.0.0"
    const isOutdated = body.agentVersion && body.agentVersion !== LATEST_AGENT_VERSION
    const serverUrl = await getCurrentServerUrl()

    return NextResponse.json(
      {
        ok: true,
        deviceId: device.id,
        updateAvailable: isOutdated,
        updateMetadata: isOutdated ? {
            version: LATEST_AGENT_VERSION,
            url: `${serverUrl}/inventario-agent.exe`
        } : null,
        client: auth.agentAuth.clientSlug
          ? {
              id: auth.agentAuth.clientId,
              name: auth.agentAuth.clientName,
              slug: auth.agentAuth.clientSlug,
            }
          : null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[agent/checkin] Erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
