'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  enqueueCollectNowAction,
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
  const [state, formAction] = useActionState(enqueueCollectNowAction, initialEnqueueCommandState)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (state.message) setFeedback(state.message)
  }, [state])

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="type" value="collect_now" />
        <SubmitButton />
      </form>
      {feedback ? (
        <p className={state.status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {feedback}
        </p>
      ) : null}
    </div>
  )
}
