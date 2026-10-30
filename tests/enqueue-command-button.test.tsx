// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  EnqueueCollectNowButton,
  EnqueueUpdateAgentButton,
} from '@/components/enqueue-command-button'

// actions.ts puxa '@/auth', que quebra fora do build real do Next no vitest.
vi.mock('@/app/app/[clientSlug]/assets/[id]/actions', () => ({
  enqueueDeviceCommandAction: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function hiddenValues(container: HTMLElement) {
  return Object.fromEntries(
    Array.from(container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')).map((input) => [
      input.name,
      input.value,
    ])
  )
}

describe('EnqueueCollectNowButton', () => {
  it('envia collect_now com tenantSlug e assetId', () => {
    const { container } = render(<EnqueueCollectNowButton assetId="a1" tenantSlug="acme" />)
    expect(hiddenValues(container)).toEqual({ tenantSlug: 'acme', assetId: 'a1', type: 'collect_now' })
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeTruthy()
  })
})

describe('EnqueueUpdateAgentButton', () => {
  it('envia update_agent com tenantSlug e assetId', () => {
    const { container } = render(<EnqueueUpdateAgentButton assetId="a1" tenantSlug="acme" />)
    expect(hiddenValues(container)).toEqual({ tenantSlug: 'acme', assetId: 'a1', type: 'update_agent' })
    expect(screen.getByRole('button', { name: 'Atualizar agente' })).toBeTruthy()
  })
})
