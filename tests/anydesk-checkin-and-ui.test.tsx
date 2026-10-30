// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { agentCheckinSchema } from '@/lib/schemas/agent-checkin'
import { AnydeskBadge, formatAnydeskId } from '@/components/anydesk-badge'

const base = { hostname: 'PC-01' }

describe('agentCheckinSchema.anydeskId', () => {
  it('aceita 9 e 10 digitos, inclusive com espacos', () => {
    expect(agentCheckinSchema.parse({ ...base, anydeskId: '123456789' }).anydeskId).toBe('123456789')
    expect(agentCheckinSchema.parse({ ...base, anydeskId: '1234567890' }).anydeskId).toBe('1234567890')
    expect(agentCheckinSchema.parse({ ...base, anydeskId: '123 456 789' }).anydeskId).toBe('123456789')
  })

  it('cai para null sem derrubar o check-in quando invalido', () => {
    const result = agentCheckinSchema.safeParse({ ...base, anydeskId: 'abc' })
    expect(result.success).toBe(true)
    expect(result.success && result.data.anydeskId).toBeNull()
  })
})

describe('<AnydeskBadge />', () => {
  it('renderiza ID formatado, botao de copiar e link anydesk:', () => {
    render(<AnydeskBadge anydeskId="123456789" />)
    expect(screen.getByText('123 456 789')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copiar ID do AnyDesk' })).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('anydesk:123456789')
  })

  it('nao renderiza link quando nulo', () => {
    const { container } = render(<AnydeskBadge anydeskId={null} />)
    expect(container.querySelector('a[href^="anydesk:"]')).toBeNull()
  })

  it('formata 10 digitos', () => {
    expect(formatAnydeskId('1234567890')).toBe('123 456 7890')
  })
})
