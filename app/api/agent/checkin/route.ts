import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateAgentApiKey, authErrorResponse } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await validateAgentApiKey(req)
  if (!auth.ok) return authErrorResponse(auth)

  const ipOrigem = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'desconhecido'

  try {
    const body = await req.json()
    const { hostname } = body

    if (!hostname || typeof hostname !== 'string') {
      return NextResponse.json({ error: '"hostname" é obrigatório.' }, { status: 400 })
    }

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
        status: 'online',
      },
      update: {
        hostname,
        serial: body.serial,
        fabricante: body.fabricante,
        modelo: body.modelo,
        dominio: body.dominio,
        usuario: body.usuario,
        status: 'online',
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

    if (Array.isArray(body.redes) && body.redes.length > 0) {
      await prisma.network.deleteMany({ where: { deviceId: device.id } })
      await prisma.network.createMany({
        data: body.redes.map((network: any) => ({
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

    if (Array.isArray(body.discos) && body.discos.length > 0) {
      await prisma.disk.deleteMany({ where: { deviceId: device.id } })
      await prisma.disk.createMany({
        data: body.discos.map((disk: any) => ({
          deviceId: device.id,
          unidade: disk.unidade,
          modelo: disk.modelo,
          tipo: disk.tipo,
          capacidadeGb: disk.capacidadeGb,
          espacoLivreGb: disk.espacoLivreGb,
        })),
      })
    }

    if (Array.isArray(body.software) && body.software.length > 0) {
      await prisma.software.deleteMany({ where: { deviceId: device.id } })
      await prisma.software.createMany({
        data: body.software.map((software: any) => ({
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
        mensagem: `Checkin via agente "${auth.agentAuth.name}"${clientLabel}`,
      },
    })

    return NextResponse.json(
      {
        ok: true,
        deviceId: device.id,
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
