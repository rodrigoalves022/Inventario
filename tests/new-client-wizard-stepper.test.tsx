// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { NewClientWizard } from '@/app/admin/clients/novo/new-client-wizard'
import type { ProvisioningActionState } from '@/app/admin/clients/types'

// Sprint A2, itens 4, 5 e 6 (E3, E5 e N13 do relatorio A0). O stepper do
// assistente "Novo cliente" era um <ol> sem nome acessivel, sem
// aria-current, com o rotulo `hidden` abaixo de `sm` (o leitor de tela nao
// ouvia o nome do passo em 390 px) e com o passo 3 eternamente "atual" mesmo
// depois da maquina conectar. A pagina tambem nao tinha h1.

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

type CreateAction = (state: ProvisioningActionState, formData: FormData) => Promise<ProvisioningActionState>

const pkgState: ProvisioningActionState = {
  error: null,
  message: 'Cliente criado.',
  package: {
    clientId: 'client-novo',
    clientName: 'Acme',
    clientSlug: 'acme',
    enrollmentKey: 'CHAVE-ACME',
    bootstrapUrl: 'https://inventario.example.com/api/agent/bootstrap?client=acme',
    bootstrapCommand: 'powershell -c "bootstrap"',
    installCommand: 'install.exe',
    // Campos da Sprint A4 (pacote Linux e SHA-256 dos binarios publicados).
    linuxBootstrapUrl: 'https://inventario.example.com/api/agent/bootstrap-linux',
    linuxBootstrapCommand: 'curl -fsSL bootstrap-linux | sudo bash',
    linuxInstallCommand: 'sudo /usr/local/bin/inventario-agent install',
    windowsSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    linuxSha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  },
}

const STEP_LABELS = ['Dados do cliente', 'Instalação', 'Primeira máquina']

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse({ agentCount: 0, device: null }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderWizard(action: CreateAction) {
  return render(<NewClientWizard serverUrl="https://inventario.example.com" createClientAction={action} />)
}

function stepper() {
  return screen.getByRole('list', { name: 'Etapas' })
}

function stepItems() {
  return within(stepper()).getAllByRole('listitem')
}

function currentIndexes() {
  return stepItems()
    .map((item, index) => (item.getAttribute('aria-current') === 'step' ? index : -1))
    .filter((index) => index >= 0)
}

async function submitStep1() {
  const form = screen.getByLabelText('Nome da empresa').closest('form')
  if (!form) throw new Error('formulario do passo 1 nao encontrado')
  await act(async () => {
    fireEvent.submit(form)
  })
}

describe('NewClientWizard — h1 da pagina (E3)', () => {
  it('tem exatamente um h1, "Novo cliente"', () => {
    const { container } = renderWizard(vi.fn<CreateAction>())

    const headings = container.querySelectorAll('h1')
    expect(headings).toHaveLength(1)
    expect(headings[0]?.textContent).toBe('Novo cliente')
  })
})

describe('NewClientWizard — stepper acessivel (E5)', () => {
  it('o <ol> tem nome acessivel "Etapas" e tres passos', () => {
    renderWizard(vi.fn<CreateAction>())

    expect(stepper().tagName).toBe('OL')
    expect(stepItems()).toHaveLength(3)
  })

  it('sem pacote: so o passo 1 tem aria-current="step" e nenhum passo esta concluido', () => {
    renderWizard(vi.fn<CreateAction>())

    expect(currentIndexes()).toEqual([0])
    for (const item of stepItems()) expect(item.textContent).not.toMatch(/concluído/)
  })

  it('o nome de cada passo esta no texto do <li> em qualquer largura (sr-only abaixo de sm, nunca hidden)', () => {
    renderWizard(vi.fn<CreateAction>())

    stepItems().forEach((item, index) => {
      expect(item.textContent).toContain(STEP_LABELS[index])
      const label = within(item).getByText(STEP_LABELS[index]!)
      expect(label.className).not.toMatch(/(^|\s)hidden(\s|$)/)
      expect(label.className).toMatch(/(^|\s)sr-only(\s|$)/)
      expect(label.className).toMatch(/sm:not-sr-only/)
    })
  })

  it('o circulo e o conector sao aria-hidden', () => {
    renderWizard(vi.fn<CreateAction>())

    const items = stepItems()
    items.forEach((item, index) => {
      const hidden = item.querySelectorAll('[aria-hidden="true"]')
      // circulo em todos; conector em todos menos o ultimo
      expect(hidden.length).toBe(index < items.length - 1 ? 2 : 1)
    })
  })

  it('com pacote: o passo 2 e o atual e o passo 1 esta concluido', async () => {
    renderWizard(vi.fn<CreateAction>(async () => pkgState))
    await submitStep1()

    expect(await screen.findByText(/Instale o agente em uma máquina de Acme/)).toBeTruthy()
    expect(currentIndexes()).toEqual([1])
    const [first, second, third] = stepItems()
    expect(first?.textContent).toMatch(/concluído/)
    expect(second?.textContent).not.toMatch(/concluído/)
    expect(third?.textContent).not.toMatch(/concluído/)
  })

  it('N13: com a maquina conectada, os tres passos estao concluidos e o passo 3 mantem aria-current', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        agentCount: 1,
        device: { id: 'device-1', hostname: 'PC-01', lastSeenAt: '2026-10-14T12:00:00.000Z' },
      })
    )
    renderWizard(vi.fn<CreateAction>(async () => pkgState))
    await submitStep1()

    expect(await screen.findByText(/PC-01 conectou/)).toBeTruthy()
    expect(currentIndexes()).toEqual([2])
    for (const item of stepItems()) expect(item.textContent).toMatch(/concluído/)
    // o passo 3 mostra o Check (svg), nao o numero
    const third = stepItems()[2]!
    expect(third.querySelector('svg')).not.toBeNull()
    expect(third.textContent).not.toContain('3')
  })
})

describe('NewClientWizard — mensagens (E5)', () => {
  it('o erro do passo 1 fica numa regiao role="alert"', async () => {
    renderWizard(
      vi.fn<CreateAction>(async () => ({ error: 'Já existe um cliente com esse nome.', message: null, package: null }))
    )
    await submitStep1()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Já existe um cliente com esse nome/)
  })
})

describe('NewClientWizard — superficies e cor (E1, E2)', () => {
  it('o passo 3 conectado usa o token success, sem emerald', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        agentCount: 1,
        device: { id: 'device-1', hostname: 'PC-01', lastSeenAt: '2026-10-14T12:00:00.000Z' },
      })
    )
    const { container } = renderWizard(vi.fn<CreateAction>(async () => pkgState))
    await submitStep1()
    await screen.findByText(/PC-01 conectou/)

    expect(container.innerHTML).not.toMatch(/emerald/)
    expect(container.innerHTML).toMatch(/text-success/)
  })

  it('os passos 2 e 3 sao Panel (section com border-surface-line) com titulo h2', async () => {
    const { container } = renderWizard(vi.fn<CreateAction>(async () => pkgState))
    await submitStep1()
    await screen.findByText(/Instale o agente em uma máquina de Acme/)

    const sections = container.querySelectorAll('section.border-surface-line')
    expect(sections.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('section h2')?.textContent).toMatch(/Instale o agente/)
  })
})
