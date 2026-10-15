// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { AgentInstallPackage } from '@/components/agent-install-package'

// Sprint A1, F3 (decisao D3 = A). A chave de instalacao NAO e exibida uma
// unica vez: ela fica guardada cifrada (AES-256-GCM, Client.activeProvisioningKeyEnc)
// e quem administra o cliente (canManageTenant) pode consulta-la de novo em
// "Ver credenciais". A copy da variante `keyIsFresh` dizia o contrario.

const pkg = {
  clientId: 'client-1',
  clientName: 'Cliente',
  clientSlug: 'cliente',
  enrollmentKey: 'CHAVE-123',
  bootstrapUrl: 'https://inventario.example.com/api/agent/bootstrap?client=cliente',
  bootstrapCommand: 'powershell -c "bootstrap"',
  installCommand: 'install.exe',
}

describe('AgentInstallPackage — copy da chave recem-emitida (F3)', () => {
  it('nao afirma mais que a chave "não será exibida novamente"', () => {
    const { container } = render(<AgentInstallPackage pkg={pkg} keyIsFresh />)

    expect(container.textContent).not.toMatch(/não será exibida novamente/i)
  })

  it('diz que a chave fica guardada cifrada e pode ser consultada em "Ver credenciais"', () => {
    const { container } = render(<AgentInstallPackage pkg={pkg} keyIsFresh />)

    expect(container.textContent).toMatch(/cifrada/i)
    expect(container.textContent).toMatch(/Ver credenciais/)
    expect(container.textContent).toMatch(/quem administra (este|o) cliente/i)
  })

  it('mantem o aviso de credencial sensivel', () => {
    const { container } = render(<AgentInstallPackage pkg={pkg} keyIsFresh />)

    expect(container.textContent).toMatch(/credencial sensível/i)
  })
})
