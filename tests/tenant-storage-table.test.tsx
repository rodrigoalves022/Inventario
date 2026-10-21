// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TenantStorageTable, type TenantStorageRow } from '@/components/tenant-storage-table'

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/app/cliente-a/storage',
}))

const devices: TenantStorageRow[] = [
  {
    id: 'd1',
    hostname: 'PC-CRITICO',
    usuario: 'joao',
    disks: [{ unidade: 'C:', tipo: 'SSD', capacidadeGb: 100, usedGb: 90 }], // 90% -> critical
    types: ['SSD'],
    presence: 'offline',
    detailsPath: '/app/cliente-a/assets/d1',
  },
  {
    id: 'd2',
    hostname: 'PC-OK',
    usuario: 'maria',
    disks: [{ unidade: 'C:', tipo: 'HDD', capacidadeGb: 100, usedGb: 20 }], // 20% -> ok
    types: ['HDD'],
    presence: 'online',
    detailsPath: '/app/cliente-a/assets/d2',
  },
  {
    id: 'd3',
    hostname: 'SRV-VS',
    usuario: null,
    disks: [
      { unidade: 'C:', tipo: 'SSD', capacidadeGb: 100, usedGb: 30 }, // 30% -> ok
      { unidade: 'D:', tipo: 'HDD', capacidadeGb: 200, usedGb: 190 }, // 95% -> critical
    ],
    types: ['SSD', 'HDD'],
    presence: 'online',
    detailsPath: '/app/cliente-a/assets/d3',
  },
  {
    id: 'd4',
    hostname: 'PC-ALERTA',
    usuario: 'ana',
    disks: [{ unidade: 'C:', tipo: 'NVMe', capacidadeGb: 100, usedGb: 70 }], // 70% -> warning
    types: ['NVMe'],
    presence: 'ausente',
    detailsPath: '/app/cliente-a/assets/d4',
  },
]

/** Le o numero exibido num card de KPI (o `<p>` do valor, nao o rotulo). */
function cardValue(testId: string): number {
  return Number(screen.getByTestId(`${testId}-value`).textContent)
}

/** Quantidade de linhas de dispositivo visiveis na tabela. */
function visibleRowCount(): number {
  return document.querySelectorAll('tbody tr').length
}

describe('TenantStorageTable — cards de KPI por faixa de uso (Sprint 15)', () => {
  it('normal + alerta + critico e exatamente o total de dispositivos com disco', () => {
    render(<TenantStorageTable devices={devices} />)

    expect(cardValue('usage-card-ok')).toBe(1) // PC-OK
    expect(cardValue('usage-card-warning')).toBe(1) // PC-ALERTA (70%)
    expect(cardValue('usage-card-critical')).toBe(2) // PC-CRITICO (90%) e SRV-VS (pior disco 95%)
    expect(cardValue('usage-card-all')).toBe(devices.length)

    // getDiskUsageTier classifica todo device em exatamente um tier
    // (<=60 / 60-80 / >80): o grid nao pode deixar nenhum de fora nem contar
    // duas vezes. Esta soma e a garantia de que os 4 numeros nao mentem.
    expect(cardValue('usage-card-all')).toBe(
      cardValue('usage-card-ok') + cardValue('usage-card-warning') + cardValue('usage-card-critical')
    )
  })

  it('o numero de cada card de faixa e exatamente a populacao mostrada ao clicar nele', () => {
    render(<TenantStorageTable devices={devices} />)

    for (const tier of ['ok', 'warning', 'critical'] as const) {
      const expected = cardValue(`usage-card-${tier}`)
      fireEvent.click(screen.getByTestId(`usage-card-${tier}`))
      expect(visibleRowCount()).toBe(expected)
      // Desliga o filtro antes da proxima faixa (toggle no mesmo card).
      fireEvent.click(screen.getByTestId(`usage-card-${tier}`))
    }
  })

  it('com filtro de tipo ativo, os cards recontam dentro do tipo (nunca prometem linha que nao aparece)', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('type-filter-SSD'))

    // SSD: PC-CRITICO (90%) e SRV-VS (95%) — ambos criticos.
    expect(cardValue('usage-card-all')).toBe(2)
    expect(cardValue('usage-card-ok')).toBe(0)
    expect(cardValue('usage-card-warning')).toBe(0)
    expect(cardValue('usage-card-critical')).toBe(2)

    fireEvent.click(screen.getByTestId('usage-card-critical'))
    expect(visibleRowCount()).toBe(2)
  })

  it('o card "Total de Dispositivos" limpa a faixa e preserva o filtro de tipo', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('type-filter-SSD'))
    fireEvent.click(screen.getByTestId('usage-card-critical'))
    expect(replaceMock).toHaveBeenLastCalledWith('/app/cliente-a/storage?tipo=SSD&faixa=critical')

    fireEvent.click(screen.getByTestId('usage-card-all'))

    expect(replaceMock).toHaveBeenLastCalledWith('/app/cliente-a/storage?tipo=SSD')
    expect(screen.getByTestId('usage-card-all').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('usage-card-critical').getAttribute('aria-pressed')).toBe('false')
  })

  it('nao existe mais fileira de badges de faixa duplicando os cards (as de tipo ficam)', () => {
    render(<TenantStorageTable devices={devices} />)

    expect(screen.queryByTestId('usage-filter-ok')).toBeNull()
    expect(screen.queryByTestId('usage-filter-warning')).toBeNull()
    expect(screen.queryByTestId('usage-filter-critical')).toBeNull()
    // A dimensao "tipo de disco" nao tem card correspondente — continua em badge.
    expect(screen.getByTestId('type-filter-SSD')).toBeTruthy()
    expect(screen.getByText('Todos os tipos')).toBeTruthy()
  })
})

describe('TenantStorageTable — badge de presenca e filtros (RN010, item 7)', () => {
  it('usa getDevicePresence (nunca device.status bruto) para o badge de status', () => {
    render(<TenantStorageTable devices={devices} />)

    // As linhas devem exibir a presenca calculada, nao um status bruto
    // tipo "warning" que nunca existiria em Device.status vindo do banco.
    expect(screen.getByText('offline')).toBeTruthy()
    expect(screen.getByText('ausente')).toBeTruthy()
    expect(screen.getAllByText('online').length).toBe(2)
  })

  it('filtro por tipo de disco (?tipo=) restringe a lista e reflete na URL', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('type-filter-SSD'))

    expect(screen.getByText('PC-CRITICO')).toBeTruthy()
    expect(screen.getByText('SRV-VS')).toBeTruthy()
    expect(screen.queryByText('PC-OK')).toBeNull()
    expect(screen.queryByText('PC-ALERTA')).toBeNull()
    expect(replaceMock).toHaveBeenCalledWith('/app/cliente-a/storage?tipo=SSD')
  })

  it('filtro por faixa de uso "critical" mostra so devices com pelo menos um disco acima de 80%', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('usage-card-critical'))

    expect(screen.getByText('PC-CRITICO')).toBeTruthy()
    // SRV-VS tem um disco ok (30%) e um critico (95%) — classificado pelo
    // PIOR disco, entao aparece no filtro "critical" mesmo com um disco ok.
    expect(screen.getByText('SRV-VS')).toBeTruthy()
    expect(screen.queryByText('PC-OK')).toBeNull()
    expect(screen.queryByText('PC-ALERTA')).toBeNull()
    expect(replaceMock).toHaveBeenCalledWith('/app/cliente-a/storage?faixa=critical')
  })

  it('filtro por faixa de uso "ok" nao mostra devices com qualquer disco critico', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('usage-card-ok'))

    expect(screen.getByText('PC-OK')).toBeTruthy()
    expect(screen.queryByText('PC-CRITICO')).toBeNull()
    // SRV-VS tem um disco critico (95%) -> nao deve aparecer no filtro "ok",
    // mesmo tendo um disco ok (30%): classificacao e pelo pior disco.
    expect(screen.queryByText('SRV-VS')).toBeNull()
  })

  it('device com 1 disco mostra uma barra de uso, com os numeros do proprio disco', () => {
    render(<TenantStorageTable devices={devices} />)

    expect(screen.getByText('C:: 90 GB de 100 GB')).toBeTruthy()
  })

  it('device com 2+ discos mostra uma barra por disco, sem somar capacidade/uso entre eles', () => {
    render(<TenantStorageTable devices={devices} />)

    // SRV-VS tem 2 discos: cada um deve aparecer com seus proprios numeros,
    // nunca uma soma agregada (que seria "220 GB de 300 GB").
    expect(screen.getByText('C:: 30 GB de 100 GB')).toBeTruthy()
    expect(screen.getByText('D:: 190 GB de 200 GB')).toBeTruthy()
    expect(screen.queryByText(/220 GB de 300 GB/)).toBeNull()
  })

  it('hostname e um link clicavel para /assets/[id]', () => {
    render(<TenantStorageTable devices={devices} />)
    const link = screen.getByText('PC-CRITICO').closest('a')
    expect(link?.getAttribute('href')).toBe('/app/cliente-a/assets/d1')
  })
})

describe('TenantStorageTable — medidor de uso de disco (Sprint V17, entrega 7)', () => {
  /** Preenchimento de cada medidor, na ordem em que aparecem na tabela. */
  function meterFills(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-disk-usage-fill]'))
  }

  it('preenche por largura com a cor chapada do tier — sem clipPath sobre uma escala em gradiente', () => {
    render(<TenantStorageTable devices={devices} />)

    const fills = meterFills()
    expect(fills.length).toBeGreaterThan(0)
    for (const fill of fills) {
      // O recorte reto do clipPath sobre o gradiente era o artefato "amarelado"
      // visto a 66%: a borda direita do recorte cortava a transicao de cor.
      expect(fill.style.clipPath).toBe('')
      expect(fill.className).not.toContain('disk-usage-scale')
      expect(fill.className).toContain('rounded-full')
      expect(fill.className).toContain('h-full')
    }
    // Nenhuma marca de limiar desenhada sobre o preenchimento.
    expect(document.querySelectorAll('.disk-usage-mark')).toHaveLength(0)
  })

  it('cada tier pinta a sua cor: verde ate 60%, ambar de 60 a 80%, vermelho acima de 80%', () => {
    render(<TenantStorageTable devices={devices} />)

    const byWidth = new Map(meterFills().map((fill) => [fill.style.width, fill.className]))
    expect(byWidth.get('20%')).toContain('bg-success') // PC-OK
    expect(byWidth.get('70%')).toContain('bg-warning') // PC-ALERTA
    expect(byWidth.get('90%')).toContain('bg-destructive') // PC-CRITICO
  })

  it('limita a largura a 100% e anima so quando o usuario nao pediu movimento reduzido', () => {
    render(
      <TenantStorageTable
        devices={[
          {
            id: 'over',
            hostname: 'PC-CHEIO',
            usuario: null,
            disks: [{ unidade: 'C:', tipo: 'SSD', capacidadeGb: 100, usedGb: 130 }],
            types: ['SSD'],
            presence: 'online',
            detailsPath: '/app/cliente-a/assets/over',
          },
        ]}
      />
    )

    const [fill] = meterFills()
    expect(fill.style.width).toBe('100%')
    expect(fill.className).toContain('motion-safe:transition-[width]')
  })
})
