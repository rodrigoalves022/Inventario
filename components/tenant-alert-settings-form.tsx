'use client'

import { useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ChevronDown, Radar, Save, Settings2, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { saveTenantAlertSettingsAction, type AlertSettingsActionState } from '@/app/app/[clientSlug]/computers/actions'
import type { InventoryAlertSettings } from '@/lib/inventory-alerts'

// Objeto simples, nao pode viver no arquivo "use server" de actions.ts: esse
// tipo de arquivo so pode exportar funcoes async, nunca valores.
const initialAlertSettingsState: AlertSettingsActionState = { status: 'idle', message: null }

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
  discoveryEnabled = false,
}: {
  tenantSlug: string
  settings: InventoryAlertSettings
  /** Sprint 14 (RN017). Prop separada de `settings` porque a varredura de rede
   * nao e' uma configuracao de alerta — ver a nota em
   * `TenantAlertSettingsRecord` (lib/tenant-alert-settings.ts). Default `false`
   * repete a postura fail-closed do banco: na duvida, desligado. */
  discoveryEnabled?: boolean
}) {
  const [state, formAction] = useActionState(saveTenantAlertSettingsAction, initialAlertSettingsState)
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-xl border bg-card overflow-hidden">
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

          <div className="grid gap-6 md:grid-cols-4">
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
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="alertsEnabled" name="alertsEnabled" defaultChecked={settings.alertsEnabled} />
                <Label htmlFor="alertsEnabled" className="font-normal text-sm cursor-pointer">
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
                <div className="flex items-center gap-2">
                  <Checkbox id="alertWebhookEnabled" name="alertWebhookEnabled" defaultChecked={settings.alertWebhookEnabled} />
                  <Label htmlFor="alertWebhookEnabled" className="font-normal text-sm cursor-pointer">
                    Habilitar envio automático
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Métricas</h3>
              <div className="space-y-1.5">
                <Label htmlFor="metricsRetentionDays" className="text-xs">Retenção da série temporal (dias)</Label>
                <Input
                  id="metricsRetentionDays"
                  name="metricsRetentionDays"
                  type="number"
                  min={7}
                  max={730}
                  defaultValue={settings.metricsRetentionDays}
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground">
                  Amostras de CPU/RAM/disco mais antigas que isso são expurgadas automaticamente.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-warning/30 bg-warning/5 p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Radar className="h-3 w-3" /> Descoberta de Rede
            </h3>
            <div className="flex items-start gap-2">
              <Checkbox
                id="discoveryEnabled"
                name="discoveryEnabled"
                defaultChecked={discoveryEnabled}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="discoveryEnabled" className="cursor-pointer text-sm font-normal">
                  Habilitar varredura de dispositivos na rede local
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desligado por padrão. Quando habilitado, os agentes deste tenant varrem a própria sub-rede /24 a cada
                  6 horas (portas TCP comuns e SNMP) para catalogar impressoras, switches, roteadores e NAS em
                  <strong> Rede → Dispositivos Descobertos</strong>. Habilite apenas em redes que pertencem a este
                  cliente: uma máquina conectada a uma rede de terceiros (Wi-Fi de hotel, residência, coworking) passa a
                  catalogar dispositivos que não são dele, e varredura de portas não solicitada costuma ser sinalizada
                  como atividade maliciosa por EDR/IDS.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t">
            <p className={`text-xs ${state.status === 'error' ? 'text-destructive font-medium' : 'text-muted-foreground italic'}`}>
              {state.message ??
                'Os webhooks disparam nas transições de status do próprio dispositivo durante o check-in, e também numa varredura de disponibilidade/disco do cliente inteiro a cada check-in de qualquer máquina. Limite conhecido: um cliente com uma única máquina, ou cuja frota inteira fica muda ao mesmo tempo, não aciona essa varredura — nenhuma nova requisição chega para reavaliar.'}
            </p>
            <SubmitButton />
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}
