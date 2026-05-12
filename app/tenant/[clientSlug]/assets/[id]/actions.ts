'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { recordAuditLog, getSessionAuditActor } from '@/lib/audit-log'
import { canDeleteTenantAsset, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantPath } from '@/lib/tenant-links'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

export type DeleteAssetActionState = {
  status: 'idle' | 'error'
  message: string | null
}

export const initialDeleteAssetState: DeleteAssetActionState = {
  status: 'idle',
  message: null,
}

const deleteAssetSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  assetId: z.string().trim().min(1),
})

export async function deleteTenantAssetAction(
  _previousState: DeleteAssetActionState,
  formData: FormData
): Promise<DeleteAssetActionState> {
  const session = await auth()
  const parsed = deleteAssetSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    assetId: formData.get('assetId'),
  })

  if (!session?.user || !parsed.success) {
    return { status: 'error', message: 'Requisição inválida.' }
  }

  const user = getSessionPermissionUser(session)

  if (!canDeleteTenantAsset(user, parsed.data.tenantSlug)) {
    return { status: 'error', message: 'Você não pode excluir máquinas deste tenant.' }
  }

  const device = await prisma.device.findFirst({
    where: {
      id: parsed.data.assetId,
      ...getTenantDeviceWhere(parsed.data.tenantSlug),
    },
    select: {
      id: true,
      hostname: true,
      agentAuth: { select: { clientId: true } },
    },
  })

  if (!device) {
    return { status: 'error', message: 'Máquina não encontrada.' }
  }

  const actor = getSessionAuditActor(user)

  await prisma.$transaction(async (tx) => {
    await tx.device.delete({ where: { id: device.id } })
    await recordAuditLog(
      {
        action: 'device.delete',
        targetType: 'device',
        targetId: device.id,
        clientId: device.agentAuth.clientId ?? actor.clientId ?? null,
        actor,
        metadata: {
          hostname: device.hostname,
          tenantSlug: parsed.data.tenantSlug,
        },
      },
      tx
    )
  })

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'computers'))
  revalidatePath(getTenantPath(parsed.data.tenantSlug))
  redirect(getTenantPath(parsed.data.tenantSlug, 'computers'))
}
