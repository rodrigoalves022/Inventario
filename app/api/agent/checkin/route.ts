import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateAgentApiKey, authErrorResponse } from '@/lib/auth'
import { getCurrentServerUrl } from '@/lib/server-url'
import { deriveInventoryIssues, getWarningTransitionIssues } from '@/lib/inventory-alerts'
import { getTenantAlertSettingsByClientId } from '@/lib/tenant-alert-settings'
import { z } from 'zod'

const networkSchema = z.object({
  ip: z.string().max(100).optional().nullable(),
  mac: z.string().max(100).optional().nullable(),
  gateway: z.string().max(100).optional().nullable(),
  dns: z.string().max(255).optional().nullable(),
  dhcp: z.boolean().optional().nullable(),
  isPrimary: z.boolean().optional().nullable(),
})

const diskSchema = z.object({
  unidade: z.string().max(20).optional().nullable(),
  modelo: z.string().max(255).optional().nullable(),
  tipo: z.string().max(50).optional().nullable(),
  capacidadeGb: z.number().int().optional().nullable(),
  espacoLivreGb: z.number().int().optional().nullable(),
})

const softwareSchema = z.object({
  nome: z.string().min(1).max(255),
  versao: z.string().max(255).optional().nullable(),
  editor: z.string().max(255).optional().nullable(),
  installadoEm: z.string().max(100).optional().nullable(),
})

const checkinSchema = z.object({
  hostname: z.string().min(1, 'hostname é obrigatório').max(255),
  agentVersion: z.string().max(50).optional().nullable(),
  serial: z.string().max(255).optional().nullable(),
  fabricante: z.string().max(255).optional().nullable(),
  modelo: z.string().max(255).optional().nullable(),
  dominio: z.string().max(255).optional().nullable(),
  usuario: z.string().max(255).optional().nullable(),

  sistema: z.string().max(255).optional().nullable(),
  versaoSO: z.string().max(255).optional().nullable(),
  processador: z.string().max(255).optional().nullable(),
  ramTotalGb: z.number().int().optional().nullable(),
  slot1: z.string().max(255).optional().nullable(),
  slot2: z.string().max(255).optional().nullable(),
  slot3: z.string().max(255).optional().nullable(),
  slot4: z.string().max(255).optional().nullable(),
  placaMae: z.string().max(255).optional().nullable(),
  tipoArmazenamento: z.string().max(255).optional().nullable(),

  redes: z.array(networkSchema).max(20).optional().default([]),
  discos: z.array(diskSchema).max(20).optional().default([]),
  software: z.array(softwareSchema).max(300).optional().default([]),
})

export async function POST(req: NextRequest) {
  const auth = await validateAgentApiKey(req)
  if (!auth.ok) return authErrorResponse(auth)

  const ipOrigem = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'desconhecido'

  try {
    const rawBody = await req.json()
    const parsed = checkinSchema.safeParse(rawBody)

    if (!parsed.success) {
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
