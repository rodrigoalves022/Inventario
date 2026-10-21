'use client'

import { useActionState, useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  changePasswordAction,
  updateEmailAction,
  updateProfileNameAction,
  type AccountActionState,
} from '@/app/account/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type AccountDialogTab = 'profile' | 'security'

const IDLE: AccountActionState = { status: 'idle', message: null }

type Action = (previous: AccountActionState, formData: FormData) => Promise<AccountActionState>

function Field({
  name,
  label,
  type = 'text',
  autoComplete,
  defaultValue,
  required = true,
}: {
  name: string
  label: string
  type?: string
  autoComplete?: string
  defaultValue?: string
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  )
}

/**
 * Um formulario = uma action. O React 19 reseta os campos nao controlados ao
 * fim da action, entao as senhas nao ficam no DOM depois do envio.
 */
function AccountForm({
  action,
  submitLabel,
  title,
  onSuccess,
  children,
}: {
  action: Action
  submitLabel: string
  title: string
  onSuccess?: () => void
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, IDLE)

  // So `state` na dependencia: `onSuccess` e recriado a cada render do pai e
  // dispararia router.refresh() em laco enquanto o estado for 'success'.
  useEffect(() => {
    if (state.status === 'success') onSuccess?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form action={formAction} className="grid gap-3" aria-label={title}>
      <h3 className="section-label">{title}</h3>
      {children}
      <div className="flex items-center justify-between gap-3">
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={cn('min-h-5 text-xs', state.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {state.message}
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function AccountDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: AccountDialogTab
  onTabChange: (tab: AccountDialogTab) => void
  user: { name?: string | null; email?: string | null }
}) {
  const router = useRouter()
  // Nome/e-mail vem do layout (Server Component) — refresh relê a sessao reemitida.
  const refresh = () => router.refresh()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Minha conta</DialogTitle>
          <DialogDescription>Dados de acesso da sua própria conta.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => onTabChange(value as AccountDialogTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="grid gap-6 pt-2">
            <AccountForm
              action={updateProfileNameAction}
              title="Nome de exibição"
              submitLabel="Salvar nome"
              onSuccess={refresh}
            >
              <Field name="name" label="Nome" autoComplete="name" defaultValue={user.name ?? ''} />
            </AccountForm>
            <AccountForm
              action={updateEmailAction}
              title="E-mail de login"
              submitLabel="Alterar e-mail"
              onSuccess={refresh}
            >
              <Field
                name="email"
                label="Novo e-mail"
                type="email"
                autoComplete="email"
                defaultValue={user.email ?? ''}
              />
              <Field name="currentPassword" label="Senha atual" type="password" autoComplete="current-password" />
            </AccountForm>
          </TabsContent>
          <TabsContent value="security" className="pt-2">
            <AccountForm action={changePasswordAction} title="Alterar senha" submitLabel="Alterar senha">
              <Field name="currentPassword" label="Senha atual" type="password" autoComplete="current-password" />
              <Field name="newPassword" label="Nova senha" type="password" autoComplete="new-password" />
              <Field name="confirmPassword" label="Confirmar nova senha" type="password" autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
            </AccountForm>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
