'use client'

import { useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ChevronDown, Save, Settings2, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { initialAlertSettingsState, saveTenantAlertSettingsAction } from '@/app/tenant/[clientSlug]/computers/actions'
import type { InventoryAlertSettings } from '@/lib/inventory-alerts'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? 'Salvando...' : 'Salvar configurações'}
    </Button>
  )
}

export function TenantAlertSettingsForm({
  tenantSlug,
  settings,
}: {
  tenantSlug: string
  settings: InventoryAlertSettings
}) {
  const [state, formAction] = useActionState(saveTenantAlertSettingsAction, initialAlertSettingsState)
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-lg border bg-card overflow-hidden">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="flex w-full items-center justify-between p-4 hover:bg-muted/50 rounded-none h-auto">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Settings2 className="h-4 w-4" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-semibold text-foreground">Configurações de Alerta</h2>
              <p className="text-xs text-muted-foreground">Thresholds de disco, memória e notificações webhook.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form action={formAction} className="border-t p-4 space-y-6">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Capacidade</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="alertDiskThresholdGb" className="text-xs">Disco mínimo livre (GB)</Label>
                  <Input id="alertDiskThresholdGb" name="alertDiskThresholdGb" type="number" min={1} max={1024} defaultValue={settings.alertDiskThresholdGb} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alertRamThresholdGb" className="text-xs">RAM mínima livre (GB)</Label>
                  <Input id="alertRamThresholdGb" name="alertRamThresholdGb" type="number" min={1} max={1024} defaultValue={settings.alertRamThresholdGb} className="h-8" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disponibilidade</h3>
              <div className="space-y-1.5">
                <Label htmlFor="alertOfflineHours" className="text-xs">Considerar Offline após (horas)</Label>
                <Input id="alertOfflineHours" name="alertOfflineHours" type="number" min={1} max={720} defaultValue={settings.alertOfflineHours} className="h-8" />
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Label className="flex items-center gap-2 font-normal text-sm">
                  <input name="alertsEnabled" type="checkbox" defaultChecked={settings.alertsEnabled} className="h-4 w-4 rounded border-input" />
                  Habilitar alertas visuais no painel
                </Label>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Webhook className="h-3 w-3" /> External Notification
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="alertWebhookUrl" className="text-xs">Webhook URL (Discord/Slack)</Label>
                  <Input id="alertWebhookUrl" name="alertWebhookUrl" type="url" placeholder="https://hooks.slack.com/..." defaultValue={settings.alertWebhookUrl ?? ''} className="h-8" />
                </div>
                <Label className="flex items-center gap-2 font-normal text-sm">
                  <input name="alertWebhookEnabled" type="checkbox" defaultChecked={settings.alertWebhookEnabled} className="h-4 w-4 rounded border-input" />
                  Habilitar envio automático
                </Label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t">
            <p className={`text-xs ${state.status === 'error' ? 'text-destructive font-medium' : 'text-muted-foreground italic'}`}>
              {state.message ?? 'Os webhooks são disparados apenas em transições de status crítico durante o check-in.'}
            </p>
            <SubmitButton />
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}
