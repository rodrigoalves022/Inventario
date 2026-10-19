'use client'

import { useState } from 'react'
import { Download, Loader2, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AgentInstallPackage } from '@/components/agent-install-package'
import type { ProvisioningCredentialsResponse } from '@/app/admin/clients/types'

type CredentialsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: ProvisioningCredentialsResponse }

const loadErrorMessage = 'Falha ao carregar credenciais ativas.'

export function TenantEmptyState({
  clientId,
  clientName,
  canManageCredentials,
}: {
  clientId: string
  clientName: string
  canManageCredentials: boolean
}) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CredentialsState>({ status: 'idle' })

  async function handleOpen() {
    setOpen(true)
    setState({ status: 'loading' })
    try {
      const response = await fetch(`/api/clients/${clientId}/credentials`, { cache: 'no-store' })
      const payload = (await response.json()) as ProvisioningCredentialsResponse | { error?: string }
      if (!response.ok) {
        throw new Error(payload && 'error' in payload && payload.error ? payload.error : loadErrorMessage)
      }
      setState({ status: 'loaded', data: payload as ProvisioningCredentialsResponse })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : loadErrorMessage })
    }
  }

  return (
    <div className="rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Monitor className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhuma máquina reportou ainda</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Instale o agente do Inventário em uma máquina de <strong className="text-foreground">{clientName}</strong> para
        começar a ver hardware, software e segurança aqui.
      </p>

      {canManageCredentials ? (
        <Button className="mt-6 gap-2" onClick={handleOpen}>
          <Download className="h-4 w-4" />
          Ver instruções de instalação
        </Button>
      ) : (
        <p className="mx-auto mt-6 max-w-md text-sm text-muted-foreground">
          Peça a um administrador da conta para instalar o agente e gerar o pacote de instalação.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Instalar o agente</DialogTitle>
            <DialogDescription>Pacote ativo de {clientName}, sem rotacionar a chave atual.</DialogDescription>
          </DialogHeader>

          {state.status === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando credenciais ativas...
            </div>
          )}

          {state.status === 'error' && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.message}
            </p>
          )}

          {state.status === 'loaded' && state.data.status === 'unavailable' && (
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {state.data.message}
            </p>
          )}

          {state.status === 'loaded' && state.data.status === 'available' && (
            <AgentInstallPackage pkg={state.data.package} keyIsFresh={false} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
