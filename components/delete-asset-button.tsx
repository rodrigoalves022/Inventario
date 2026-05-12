'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  deleteTenantAssetAction,
  initialDeleteAssetState,
} from '@/app/tenant/[clientSlug]/assets/[id]/actions'

function ConfirmDeleteButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      <Trash2 className="h-4 w-4" />
      {pending ? 'Excluindo...' : 'Excluir máquina'}
    </Button>
  )
}

export function DeleteAssetButton({
  assetId,
  assetName,
  tenantSlug,
}: {
  assetId: string
  assetName: string
  tenantSlug: string
}) {
  const [state, formAction] = useActionState(deleteTenantAssetAction, initialDeleteAssetState)

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir máquina</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação remove <strong>{assetName}</strong> e seus dados coletados. Use apenas quando o ativo não existir mais.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <input type="hidden" name="assetId" value={assetId} />

          {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </AlertDialogCancel>
            <ConfirmDeleteButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
