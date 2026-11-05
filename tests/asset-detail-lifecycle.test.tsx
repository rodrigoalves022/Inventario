// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssetRecordForm } from '@/components/asset-record-form'
import { AssetMaintenanceList } from '@/components/asset-maintenance-list'

vi.mock('@/app/app/[clientSlug]/assets/[id]/actions', () => ({
  saveAssetRecordAction: vi.fn(),
  createAssetMaintenanceAction: vi.fn(),
  deleteAssetMaintenanceAction: vi.fn(),
}))

describe('AssetRecordForm — Ciclo de Vida & Depreciação Contábil', () => {
  it('renderiza seletor de status de ciclo de vida e campos de depreciacao', () => {
    render(
      <AssetRecordForm
        tenantSlug="empresa-a"
        deviceId="dev-1"
        values={{
          etiqueta: 'PAT-100',
          dataCompra: '2024-01-15T00:00:00Z',
          notaFiscal: 'NF-1234',
          fornecedor: 'Dell Computadores',
          valor: 6000,
          garantiaAte: '2027-01-15T00:00:00Z',
          centroCusto: 'TI',
          localizacao: 'Sede SP',
          responsavel: 'Carlos Lima',
          observacoes: 'Notebook de desenvolvimento',
          lifecycleStatus: 'IN_USE',
          usefulLifeMonths: 60,
          salvageValue: 600,
        }}
      />
    )

    // Seletor de status
    expect(screen.getByLabelText(/Status do Ciclo de Vida/i)).toBeDefined()
    expect(screen.getByText(/Em Uso \(Ativo operacional\)/i)).toBeDefined()

    // Bloco contábil
    expect(screen.getByText(/Apuração Contábil & Depreciação Linear/i)).toBeDefined()
    expect(screen.getByText(/Valor de Aquisição/i)).toBeDefined()
    expect(screen.getByText(/Valor Contábil Líquido Atual/i)).toBeDefined()

    // Campos adicionais
    expect(screen.getByLabelText(/Vida útil contábil/i)).toBeDefined()
    expect(screen.getByLabelText(/Valor residual final/i)).toBeDefined()
  })
})

describe('AssetMaintenanceList', () => {
  it('exibe mensagem quando nao ha manutencoes registradas', () => {
    render(
      <AssetMaintenanceList
        tenantSlug="empresa-a"
        deviceId="dev-1"
        maintenances={[]}
        canManage={true}
      />
    )

    expect(screen.getByText(/Nenhuma manutenção ou intervenção técnica registrada/i)).toBeDefined()
    expect(screen.getByText(/Registrar Manutenção/i)).toBeDefined()
  })

  it('renderiza lista de manutencoes com badges, custos e executores', () => {
    const items = [
      {
        id: 'm-1',
        type: 'PREVENTIVE',
        title: 'Limpeza e troca de pasta térmica',
        description: 'Revisão semestral de rotina',
        cost: 150,
        performedBy: 'Técnico Roberto',
        startDate: '2026-03-10T10:00:00Z',
        completedDate: '2026-03-10T12:00:00Z',
        status: 'COMPLETED',
      },
      {
        id: 'm-2',
        type: 'UPGRADE',
        title: 'Upgrade de Memória RAM para 32GB',
        description: 'Adicionados 2 pentes de 8GB Kingston',
        cost: 450,
        performedBy: 'Laboratório Central',
        startDate: '2026-05-02T14:00:00Z',
        completedDate: null,
        status: 'IN_PROGRESS',
      },
    ]

    render(
      <AssetMaintenanceList
        tenantSlug="empresa-a"
        deviceId="dev-1"
        maintenances={items}
        canManage={true}
      />
    )

    expect(screen.getByText(/Limpeza e troca de pasta térmica/i)).toBeDefined()
    expect(screen.getByText(/Upgrade de Memória RAM para 32GB/i)).toBeDefined()
    expect(screen.getByText(/Preventiva/i)).toBeDefined()
    expect(screen.getByText('Upgrade')).toBeDefined()
    expect(screen.getByText(/Técnico Roberto/i)).toBeDefined()
    expect(screen.getByText(/Laboratório Central/i)).toBeDefined()
    expect(screen.getByText(/Em andamento/i)).toBeDefined()
  })
})
