'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { recordAuditLog, getSessionAuditActor } from '@/lib/audit-log'
import { canOperateTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantPath } from '@/lib/tenant-links'
import { softwareLicenseInputSchema } from '@/lib/schemas/software-license'

export type LicenseActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

export async function saveLicenseAction(
  tenantSlug: string,
  formData: FormData
): Promise<LicenseActionState> {
  const session = await auth()
  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(tenantSlug)

  if (!tenant || !canOperateTenant(user, tenant)) {
    return { status: 'error', message: 'Você não tem permissão para gerenciar licenças deste cliente.' }
  }

  const raw = {
    id: formData.get('id') ? String(formData.get('id')) : undefined,
    softwareName: String(formData.get('softwareName') || ''),
    licenseKey: formData.get('licenseKey') ? String(formData.get('licenseKey')) : null,
    seatsPurchased: formData.get('seatsPurchased'),
    contractRef: formData.get('contractRef') ? String(formData.get('contractRef')) : null,
    supplier: formData.get('supplier') ? String(formData.get('supplier')) : null,
    cost: formData.get('cost') ? formData.get('cost') : null,
    expiresAt: formData.get('expiresAt') ? String(formData.get('expiresAt')) : null,
    notes: formData.get('notes') ? String(formData.get('notes')) : null,
  }

  const parsed = softwareLicenseInputSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return { status: 'error', message: firstError }
  }

  const { id, softwareName, licenseKey, seatsPurchased, contractRef, supplier, cost, expiresAt, notes } = parsed.data
  const actor = getSessionAuditActor(session)
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null

  try {
    if (id) {
      // Atualização
      const existing = await prisma.softwareLicense.findFirst({
        where: { id, clientId: tenant.id },
      })
      if (!existing) {
        return { status: 'error', message: 'Licença não encontrada.' }
      }

      const updated = await prisma.softwareLicense.update({
        where: { id },
        data: {
          softwareName,
          licenseKey,
          seatsPurchased,
          contractRef,
          supplier,
          cost,
          expiresAt: expiresAtDate,
          notes,
        },
      })

      await recordAuditLog({
        actor,
        action: 'license.update',
        targetType: 'SoftwareLicense',
        targetId: updated.id,
        targetName: updated.softwareName,
        metadata: {
          clientId: tenant.id,
          seatsPurchased: updated.seatsPurchased,
          cost: updated.cost,
        },
      })
    } else {
      // Criação
      const created = await prisma.softwareLicense.create({
        data: {
          clientId: tenant.id,
          softwareName,
          licenseKey,
          seatsPurchased,
          contractRef,
          supplier,
          cost,
          expiresAt: expiresAtDate,
          notes,
          createdByUserId: actor.userId,
        },
      })

      await recordAuditLog({
        actor,
        action: 'license.create',
        targetType: 'SoftwareLicense',
        targetId: created.id,
        targetName: created.softwareName,
        metadata: {
          clientId: tenant.id,
          seatsPurchased: created.seatsPurchased,
          cost: created.cost,
        },
      })
    }

    revalidatePath(getTenantPath(tenantSlug, 'software'))
    return { status: 'success', message: 'Licença salva com sucesso.' }
  } catch (error) {
    console.error('[saveLicenseAction] Falha ao salvar licença:', error)
    return { status: 'error', message: 'Erro interno ao salvar a licença.' }
  }
}

export async function deleteLicenseAction(
  tenantSlug: string,
  licenseId: string
): Promise<LicenseActionState> {
  const session = await auth()
  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(tenantSlug)

  if (!tenant || !canOperateTenant(user, tenant)) {
    return { status: 'error', message: 'Você não tem permissão para excluir licenças deste cliente.' }
  }

  try {
    const existing = await prisma.softwareLicense.findFirst({
      where: { id: licenseId, clientId: tenant.id },
    })

    if (!existing) {
      return { status: 'error', message: 'Licença não encontrada.' }
    }

    await prisma.softwareLicense.delete({
      where: { id: licenseId },
    })

    const actor = getSessionAuditActor(session)
    await recordAuditLog({
      actor,
      action: 'license.delete',
      targetType: 'SoftwareLicense',
      targetId: licenseId,
      targetName: existing.softwareName,
      metadata: { clientId: tenant.id },
    })

    revalidatePath(getTenantPath(tenantSlug, 'software'))
    return { status: 'success', message: 'Licença excluída com sucesso.' }
  } catch (error) {
    console.error('[deleteLicenseAction] Falha ao excluir licença:', error)
    return { status: 'error', message: 'Erro interno ao excluir a licença.' }
  }
}

