import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isServerOperatingSystem } from '@/lib/device-classification'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug')?.trim().toLowerCase()

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug é obrigatório.' }, { status: 400 })
    }

    const tenant = await getTenantContext(clientSlug)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado ou inativo.' }, { status: 404 })
    }

    const devices = await prisma.device.findMany({
      where: getTenantDeviceWhere(clientSlug),
      orderBy: { updatedAt: 'desc' },
      include: {
        hardware: { select: { sistema: true, processador: true, ramTotalGb: true, tipoArmazenamento: true } },
        networks: { where: { isPrimary: true }, select: { ip: true, mac: true } },
        disks: { select: { unidade: true, capacidadeGb: true, espacoLivreGb: true, tipo: true } },
      },
    })

    const computers = devices
      .filter((device) => !isServerOperatingSystem(device.hardware?.sistema))
      .map((device) => ({
        id: device.id,
        hostname: device.hostname,
        status: device.status,
        updatedAt: device.updatedAt,
        tenant,
        hardware: device.hardware,
        primaryNetwork: device.networks[0] ?? null,
        disks: device.disks,
      }))

    return NextResponse.json(computers)
  } catch (error) {
    console.error('[inventory/computers] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar computadores.' }, { status: 500 })
  }
}
