'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  enqueueDeviceCommandAction,
  type EnqueueCommandActionState,
} from '@/app/tenant/[clientSlug]/assets/[id]/actions'

// Objeto simples, nao pode viver no arquivo "use server" de actions.ts: esse
// tipo de arquivo so pode exportar funcoes async, nunca valores.
const initialEnqueueCommandState: EnqueueCommandActionState = { status: 'idle', message: null }

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" size="sm" className="gap-2" disabled={pending}>
      <RefreshCw className={pending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
      {pending ? 'Enfileirando...' : 'Atualizar'}
    </Button>
  )
}

export function EnqueueCollectNowButton({
  assetId,
  tenantSlug,
}: {
  assetId: string
  tenantSlug: string
}) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, initialEnqueueCommandState)

  useEffect(() => {
    if (!state.message) return
    if (state.status === 'error') toast.error(state.message)
    else toast.success(state.message)
  }, [state])

  return (
    <form action={formAction}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="type" value="collect_now" />
      <SubmitButton />
    </form>
  )
}
