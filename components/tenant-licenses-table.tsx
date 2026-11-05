'use client'

import { useState, useTransition } from 'react'
import {
  Search,
  Plus,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Monitor,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KpiCard } from '@/components/ui/kpi-card'
import { StatusPill } from '@/components/ui/status-pill'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  ReconciledLicenseItem,
  LicenseSummary,
  LICENSE_STATUS_LABELS,
  LICENSE_STATUS_BADGE_CLASS,
} from '@/lib/licenses'
import { saveLicenseAction, deleteLicenseAction } from '@/app/app/[clientSlug]/software/licenses/actions'
import { cn } from '@/lib/utils'

export function TenantLicensesTable({
  tenantSlug,
  reconciledData,
  canManageLicenses,
}: {
  tenantSlug: string
  reconciledData: {
    items: ReconciledLicenseItem[]
    summary: LicenseSummary
  }
  canManageLicenses: boolean
}) {
  const { items, summary } = reconciledData
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLicense, setEditingLicense] = useState<ReconciledLicenseItem | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filteredItems = items.filter((item) => {
    const query = search.trim().toLowerCase()
    const matchesSearch =
      !query ||
      item.softwareName.toLowerCase().includes(query) ||
      (item.supplier && item.supplier.toLowerCase().includes(query)) ||
      (item.contractRef && item.contractRef.toLowerCase().includes(query))

    const matchesStatus = filterStatus === 'all' || item.status === filterStatus

    return matchesSearch && matchesStatus
  })

  function handleOpenCreate() {
    setEditingLicense(null)
    setFormError(null)
    setDialogOpen(true)
  }

  function handleOpenEdit(item: ReconciledLicenseItem) {
    setEditingLicense(item)
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await saveLicenseAction(tenantSlug, formData)
      if (res.status === 'error') {
        setFormError(res.message)
      } else {
        setDialogOpen(false)
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir esta licença do controle?')) return

    setDeleteId(id)
    startTransition(async () => {
      await deleteLicenseAction(tenantSlug, id)
      setDeleteId(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Licenciamento */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de licenças"
          value={`${summary.totalInstalled} / ${summary.totalPurchased}`}
          subtitle={`${summary.totalPurchased - summary.totalInstalled} assento(s) disponível(is)`}
          icon={<Coins className="h-4 w-4" />}
          tone="primary"
          active={filterStatus === 'all'}
          onClick={() => setFilterStatus('all')}
        />
        <KpiCard
          label="Em conformidade"
          value={summary.compliantCount}
          subtitle="Dentro da cota adquirida"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          active={filterStatus === 'COMPLIANT'}
          onClick={() => setFilterStatus('COMPLIANT')}
        />
        <KpiCard
          label="Licenças excedidas"
          value={summary.overusedCount}
          subtitle={summary.overusedCount > 0 ? 'Instalações excedem compra' : 'Nenhuma licença excedida'}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={summary.overusedCount > 0 ? 'destructive' : 'neutral'}
          emphasizeValue={summary.overusedCount > 0}
          active={filterStatus === 'OVERUSED'}
          onClick={() => setFilterStatus('OVERUSED')}
        />
        <KpiCard
          label="Ociosas / Vencendo"
          value={summary.unusedCount + summary.expiringCount + summary.expiredCount}
          subtitle={`${summary.unusedCount} sem uso · ${summary.expiringCount + summary.expiredCount} atenção prazo`}
          icon={<Clock className="h-4 w-4" />}
          tone={summary.expiredCount > 0 ? 'warning' : 'neutral'}
          active={filterStatus === 'UNUSED' || filterStatus === 'EXPIRING_SOON'}
          onClick={() => setFilterStatus(summary.unusedCount > 0 ? 'UNUSED' : 'EXPIRING_SOON')}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por software, fornecedor ou contrato..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          {filterStatus !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setFilterStatus('all')} className="text-xs">
              Limpar filtro de status
            </Button>
          )}

          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/api/tenant/${tenantSlug}/software/licenses/csv`}>
              <Download className="h-4 w-4" />
              Baixar CSV
            </a>
          </Button>

          {canManageLicenses && (
            <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Cadastrar Licença
            </Button>
          )}
        </div>
      </div>

      {/* Tabela de Licenças */}
      <div className="overflow-x-auto rounded-lg border border-surface-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-line bg-secondary/30 text-xs font-semibold text-muted-foreground">
              <th className="px-4 py-3">Software & Chave</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Uso / Capacidade</th>
              <th className="px-4 py-3">Contrato & Fornecedor</th>
              <th className="px-4 py-3">Custo Total</th>
              <th className="px-4 py-3">Validade</th>
              {canManageLicenses && <th className="px-4 py-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-line">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={canManageLicenses ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma licença encontrada para o critério selecionado.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isExpanded = expandedRow === item.id
                const usagePercent =
                  item.seatsPurchased > 0
                    ? Math.round((item.seatsInstalled / item.seatsPurchased) * 100)
                    : 100

                return (
                  <tr key={item.id} className="group hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.installedDevices.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label={isExpanded ? 'Recolher máquinas' : 'Ver máquinas'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{item.softwareName}</p>
                          {item.licenseKey ? (
                            <p className="data-mono text-xs text-muted-foreground">Chave: {item.licenseKey}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem chave informada</p>
                          )}
                        </div>
                      </div>

                      {/* Accordion de Máquinas Instaladas */}
                      {isExpanded && item.installedDevices.length > 0 && (
                        <div className="mt-3 ml-6 space-y-1.5 rounded-lg border border-surface-line bg-secondary/40 p-2.5">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Máquinas onde o software está instalado ({item.installedDevices.length}):
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.installedDevices.map((dev) => (
                              <span
                                key={dev.deviceId}
                                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs text-foreground"
                              >
                                <Monitor className="h-3 w-3 text-muted-foreground" />
                                <span className="data-mono font-medium">{dev.hostname}</span>
                                {dev.version && <span className="text-muted-foreground">v{dev.version}</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          LICENSE_STATUS_BADGE_CLASS[item.status]
                        )}
                      >
                        {LICENSE_STATUS_LABELS[item.status]}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="min-w-[140px] space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {item.seatsInstalled} de {item.seatsPurchased}
                          </span>
                          <span
                            className={cn(
                              'font-semibold',
                              item.seatsAvailable < 0
                                ? 'text-destructive'
                                : item.seatsAvailable === 0
                                  ? 'text-warning'
                                  : 'text-success'
                            )}
                          >
                            {item.seatsAvailable < 0
                              ? `${Math.abs(item.seatsAvailable)} excedida(s)`
                              : `${item.seatsAvailable} disp.`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              item.status === 'OVERUSED'
                                ? 'bg-destructive/75'
                                : item.status === 'UNUSED'
                                  ? 'bg-muted-foreground/30'
                                  : 'bg-info/60'
                            )}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.contractRef ? (
                        <p className="font-medium text-foreground">{item.contractRef}</p>
                      ) : (
                        <p>—</p>
                      )}
                      {item.supplier && <p>{item.supplier}</p>}
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {item.cost != null ? (
                        <span className="data-mono font-medium text-foreground">
                          R$ {item.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {item.expiresAt ? (
                        <span
                          className={cn(
                            'font-medium',
                            item.isExpired
                              ? 'text-destructive'
                              : item.isExpiringSoon
                                ? 'text-warning'
                                : 'text-foreground'
                          )}
                        >
                          {new Date(item.expiresAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Vitalícia / Perpétua</span>
                      )}
                    </td>

                    {canManageLicenses && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(item)}
                            className="h-8 w-8 p-0"
                            aria-label={`Editar licença ${item.softwareName}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending && deleteId === item.id}
                            onClick={() => handleDelete(item.id)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Excluir licença ${item.softwareName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog para Cadastrar / Editar Licença */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingLicense ? 'Editar Licença de Software' : 'Cadastrar Nova Licença'}
              </DialogTitle>
              <DialogDescription>
                Informe os dados do contrato ou aquisição para conciliação automática com o inventário.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="my-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {formError}
              </div>
            )}

            {editingLicense && <input type="hidden" name="id" value={editingLicense.id} />}

            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="softwareName">Nome do Software *</Label>
                <Input
                  id="softwareName"
                  name="softwareName"
                  defaultValue={editingLicense?.softwareName ?? ''}
                  placeholder="Ex: Microsoft Office 365, Adobe Photoshop"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  O sistema casa automaticamente este nome com os aplicativos coletados pelo agente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="seatsPurchased">Quantidade Adquirida *</Label>
                  <Input
                    id="seatsPurchased"
                    name="seatsPurchased"
                    type="number"
                    min="1"
                    defaultValue={editingLicense?.seatsPurchased ?? 1}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cost">Custo Total (R$)</Label>
                  <Input
                    id="cost"
                    name="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingLicense?.cost ?? ''}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="licenseKey">Chave / Serial do Produto (Opcional)</Label>
                <Input
                  id="licenseKey"
                  name="licenseKey"
                  defaultValue={editingLicense?.licenseKey ?? ''}
                  placeholder="Ex: XXXXX-XXXXX-XXXXX"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="contractRef">Contrato / Pedido / NF</Label>
                  <Input
                    id="contractRef"
                    name="contractRef"
                    defaultValue={editingLicense?.contractRef ?? ''}
                    placeholder="Ex: CTR-2026-001"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="supplier">Fornecedor / Revenda</Label>
                  <Input
                    id="supplier"
                    name="supplier"
                    defaultValue={editingLicense?.supplier ?? ''}
                    placeholder="Ex: Microsoft, SND, Fast"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="expiresAt">Data de Validade (Deixe em branco se perpétua)</Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  defaultValue={
                    editingLicense?.expiresAt ? editingLicense.expiresAt.split('T')[0] : ''
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  name="notes"
                  defaultValue={editingLicense?.notes ?? ''}
                  placeholder="Ex: Licença vinculada ao departamento financeiro"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar Licença'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
