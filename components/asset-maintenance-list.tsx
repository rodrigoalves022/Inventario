'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus, Trash2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  createAssetMaintenanceAction,
  deleteAssetMaintenanceAction,
  type AssetMaintenanceActionState,
} from '@/app/app/[clientSlug]/assets/[id]/actions'
import { formatBRL, MAINTENANCE_TYPE_LABELS, type AssetMaintenanceType } from '@/lib/asset-depreciation'

export interface AssetMaintenanceItem {
  id: string
  type: string
  title: string
  description?: string | null
  cost?: number | null
  performedBy?: string | null
  startDate: string
  completedDate?: string | null
  status: string
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  PREVENTIVE: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  CORRECTIVE: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  UPGRADE: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
}

const initialActionState: AssetMaintenanceActionState = { status: 'idle', message: null }

function SubmitMaintButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar manutenção'}
    </Button>
  )
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

export function AssetMaintenanceList({
  tenantSlug,
  deviceId,
  maintenances,
  canManage,
}: {
  tenantSlug: string | null
  deviceId: string
  maintenances: AssetMaintenanceItem[]
  canManage: boolean
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createState, createFormAction] = useActionState(createAssetMaintenanceAction, initialActionState)
  const [, deleteFormAction] = useActionState(deleteAssetMaintenanceAction, initialActionState)

  const handleAction = async (formData: FormData) => {
    await createFormAction(formData)
    setDialogOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">
            Histórico de Manutenções & Intervenções ({maintenances.length})
          </h4>
        </div>
        {canManage && tenantSlug && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Registrar Manutenção
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form action={handleAction} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Registrar Intervenção Técnica</DialogTitle>
                  <DialogDescription>
                    Registre manutenções preventivas, corretivas ou upgrades com custo e responsável.
                  </DialogDescription>
                </DialogHeader>

                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="deviceId" value={deviceId} />

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="maint-type" className="text-xs">Tipo de intervenção</Label>
                    <select
                      id="maint-type"
                      name="type"
                      defaultValue="PREVENTIVE"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="PREVENTIVE">Preventiva</option>
                      <option value="CORRECTIVE">Corretiva</option>
                      <option value="UPGRADE">Upgrade de hardware / componentes</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="maint-title" className="text-xs">Título / Resumo *</Label>
                    <Input
                      id="maint-title"
                      name="title"
                      placeholder="Ex: Troca de SSD por NVMe 1TB"
                      required
                      maxLength={150}
                      className="h-9"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="maint-cost" className="text-xs">Custo (R$)</Label>
                      <Input
                        id="maint-cost"
                        name="cost"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="maint-performedBy" className="text-xs">Técnico / Fornecedor</Label>
                      <Input
                        id="maint-performedBy"
                        name="performedBy"
                        placeholder="Ex: Suporte Local"
                        maxLength={100}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="maint-startDate" className="text-xs">Data da intervenção</Label>
                      <Input
                        id="maint-startDate"
                        name="startDate"
                        type="date"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="maint-status" className="text-xs">Status</Label>
                      <select
                        id="maint-status"
                        name="status"
                        defaultValue="COMPLETED"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="COMPLETED">Concluída</option>
                        <option value="IN_PROGRESS">Em andamento</option>
                        <option value="PENDING">Pendente</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="maint-description" className="text-xs">Observações detalhadas</Label>
                    <Textarea
                      id="maint-description"
                      name="description"
                      placeholder="Detalhes das peças trocadas, número da OS ou nota..."
                      rows={3}
                      maxLength={2000}
                    />
                  </div>
                </div>

                {createState.status === 'error' && (
                  <p className="text-xs font-medium text-destructive">{createState.message}</p>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <SubmitMaintButton />
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {maintenances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-surface-line p-6 text-center">
          <p className="text-xs text-muted-foreground">
            Nenhuma manutenção ou intervenção técnica registrada para este ativo.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {maintenances.map((m) => {
            const badgeClass = TYPE_BADGE_CLASS[m.type] || 'border-border bg-secondary text-foreground'
            const typeLabel = MAINTENANCE_TYPE_LABELS[m.type as AssetMaintenanceType] || m.type

            return (
              <div
                key={m.id}
                className="flex flex-col gap-2 rounded-lg border border-surface-line bg-secondary/30 p-3.5 transition-colors sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${badgeClass}`}>
                      {typeLabel}
                    </span>
                    <span className="text-sm font-medium text-foreground">{m.title}</span>
                    {m.cost != null && m.cost > 0 && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                        {formatBRL(m.cost)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Data: {formatDate(m.startDate)}</span>
                    {m.performedBy && <span>Executor: {m.performedBy}</span>}
                    {m.status === 'IN_PROGRESS' && (
                      <span className="text-amber-400 font-medium">● Em andamento</span>
                    )}
                  </div>

                  {m.description && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{m.description}</p>
                  )}
                </div>

                {canManage && tenantSlug && (
                  <form action={deleteFormAction} className="shrink-0 self-end sm:self-center">
                    <input type="hidden" name="tenantSlug" value={tenantSlug} />
                    <input type="hidden" name="deviceId" value={deviceId} />
                    <input type="hidden" name="maintenanceId" value={m.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Excluir intervenção"
                      onClick={(e) => {
                        if (!confirm('Deseja realmente excluir este registro de manutenção?')) {
                          e.preventDefault()
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
