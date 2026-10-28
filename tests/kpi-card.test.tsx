// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Monitor } from 'lucide-react'
import { KpiCard } from '@/components/ui/kpi-card'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

/**
 * KpiCard — tipo 1 da familia fechada de superficies (Sprint 16).
 *
 * NOTA DE METODO: jsdom nao calcula layout. `offsetTop` e `getBoundingClientRect`
 * devolvem zero para tudo, entao NAO da para medir pixels aqui. O que estes
 * testes travam e' o MECANISMO que produz o alinhamento — a ordem dos nos, a
 * altura fixa do cabecalho e o `line-clamp-1` do rotulo. Se alguem reintroduzir
 * `justify-between` ou mover o subtitulo para antes do valor, estes testes
 * quebram; uma medicao real de pixels exigiria navegador.
 */

function cardRoot(testId: string) {
  return screen.getByTestId(testId)
}

describe('KpiCard — invariante de alinhamento do numero', () => {
  it('em dois cards da mesma fileira, o valor tem os MESMOS irmaos anteriores, com as mesmas classes', () => {
    render(
      <>
        <KpiCard
          testId="curto"
          label="Online"
          value={12}
          subtitle="94% de disponibilidade"
          icon={<Monitor />}
          tone="success"
        />
        <KpiCard
          testId="longo"
          label="Em atenção com um rótulo deliberadamente longo para forçar truncamento"
          value={3}
          subtitle="Disco abaixo de 10 GB livres ou RAM abaixo do limiar configurado para este tenant, texto longo de proposito"
          icon={<Monitor />}
          tone="warning"
        />
      </>
    )

    for (const testId of ['curto', 'longo']) {
      const root = cardRoot(testId)
      const value = root.querySelector('[data-kpi-value]')
      expect(value, `valor de ${testId}`).toBeTruthy()

      // O unico irmao ANTES do valor e' o cabecalho de altura fixa.
      const previous = value!.previousElementSibling
      expect(previous?.getAttribute('data-kpi-header'), `cabecalho de ${testId}`).not.toBeNull()
      expect(previous?.className).toContain('h-8')
      expect(value!.className).toContain('mt-3')
    }
  })

  it('o subtitulo vem DEPOIS do valor, entao seu comprimento nao pode desloca-lo', () => {
    render(
      <KpiCard
        testId="card"
        label="Em atenção"
        value={7}
        subtitle="Um subtítulo bem longo que quebraria em três linhas numa coluna estreita de grid"
        icon={<Monitor />}
        tone="warning"
      />
    )

    const root = cardRoot('card')
    const value = root.querySelector('[data-kpi-value]')!
    const subtitle = root.querySelector('[data-kpi-subtitle]')!

    // `compareDocumentPosition` com FOLLOWING (4) prova a ordem no documento.
    expect(value.compareDocumentPosition(subtitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('o rotulo trunca em uma linha, para nao crescer o cabecalho e empurrar o numero', () => {
    render(<KpiCard testId="card" label="Rótulo muito longo mesmo" value={1} />)
    const label = cardRoot('card').querySelector('[data-kpi-header] p')!
    expect(label.className).toContain('line-clamp-1')
  })

  it('justify-between (V23) so distribui TOPO e subtitulo — o valor nunca e filho direto do card', () => {
    // O defeito antigo: valor e subtitulo juntos na base de um justify-between.
    // Agora o valor mora no bloco do topo, e so o subtitulo vai para a base.
    render(<KpiCard testId="card" label="Online" value={1} subtitle="ctx" icon={<Monitor />} />)
    const root = cardRoot('card')
    const value = root.querySelector('[data-kpi-value]')!
    expect(value.parentElement?.hasAttribute('data-kpi-top')).toBe(true)
    expect(root.querySelector('[data-kpi-subtitle]')!.parentElement).toBe(root)
  })

  it('o cabecalho mantem altura fixa mesmo SEM icone, para alinhar com cards que tem icone', () => {
    render(
      <>
        <KpiCard testId="com-icone" label="Com" value={1} icon={<Monitor />} />
        <KpiCard testId="sem-icone" label="Sem" value={2} />
      </>
    )

    const comIcone = cardRoot('com-icone').querySelector('[data-kpi-header]')!
    const semIcone = cardRoot('sem-icone').querySelector('[data-kpi-header]')!
    expect(comIcone.className).toBe(semIcone.className)
    expect(semIcone.className).toContain('h-8')
  })
})

describe('KpiCard — interatividade so quando ha para onde ir', () => {
  it('sem href e sem onClick, NAO renderiza classe interativa nem cursor-pointer', () => {
    render(<KpiCard testId="estatico" label="Taxa de disponibilidade" value="94%" />)
    const root = cardRoot('estatico')

    expect(root.className).not.toContain('surface-interactive')
    expect(root.className).not.toContain('cursor-pointer')
    expect(root.tagName).toBe('DIV')
  })

  it('com href, renderiza ancora com o destino e ganha a classe interativa', () => {
    render(<KpiCard testId="link" label="Online" value={5} href="/app/cliente-a/assets?status=online" />)
    const root = cardRoot('link')

    expect(root.tagName).toBe('A')
    expect(root.getAttribute('href')).toBe('/app/cliente-a/assets?status=online')
    expect(root.className).toContain('surface-interactive')
  })

  it('com onClick, renderiza button com aria-pressed refletindo `active`', () => {
    const onClick = vi.fn()
    render(<KpiCard testId="filtro" label="Crítico" value={2} onClick={onClick} active />)
    const root = cardRoot('filtro')

    expect(root.tagName).toBe('BUTTON')
    expect(root.getAttribute('type')).toBe('button')
    expect(root.getAttribute('aria-pressed')).toBe('true')
    expect(root.className).toContain('surface-interactive')
  })

  it('um card com href nao aninha outra ancora dentro de si', () => {
    const { container } = render(
      <KpiCard testId="link" label="Online" value={5} icon={<Monitor />} href="/app/cliente-a/assets" />
    )
    expect(container.querySelectorAll('a a').length).toBe(0)
  })
})

describe('KpiCard — cor do numero', () => {
  it('sem `emphasizeValue`, o numero NAO herda a cor do tom (um zero nao pode parecer alerta)', () => {
    render(<KpiCard testId="zero" label="Em atenção" value={0} tone="warning" />)
    const value = cardRoot('zero').querySelector('[data-kpi-value]')!

    expect(value.className).toContain('text-card-foreground')
    expect(value.className).not.toContain('text-warning')
  })

  it('com `emphasizeValue`, o numero recebe a cor do tom', () => {
    render(<KpiCard testId="alerta" label="Em atenção" value={4} tone="warning" emphasizeValue />)
    const value = cardRoot('alerta').querySelector('[data-kpi-value]')!

    expect(value.className).toContain('text-warning')
  })

  it('expoe `<testId>-value` para os testes que leem o numero direto', () => {
    render(<KpiCard testId="usage-card-critical" label="Crítico" value={9} tone="destructive" />)
    expect(screen.getByTestId('usage-card-critical-value').textContent).toBe('9')
  })
})

describe('KpiCard — o chamador nao controla o tamanho do icone', () => {
  it('o chip impoe o tamanho do SVG, entao tres tamanhos diferentes nao voltam a existir', () => {
    render(<KpiCard testId="card" label="Total" value={1} icon={<Monitor className="h-12 w-12" />} />)
    const chip = cardRoot('card').querySelector('[data-kpi-header] > div')!

    // O chip e' 32px fixo e normaliza o SVG recebido, mesmo que o chamador
    // tenha passado h-12 w-12.
    expect(chip.className).toContain('h-8')
    expect(chip.className).toContain('w-8')
    expect(chip.className).toContain('[&>svg]:size-4')
  })
})
