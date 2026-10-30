// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuditLogTable } from '@/components/audit-log-table'
import type { AuditLogListItem } from '@/lib/audit-log'

/**
 * Sprint A53 — rotulos em portugues para todo o catalogo de acoes, tons calmos
 * nos badges e celulas clicaveis (acao, operador, tenant) que filtram o log.
 */

function makeLog(overrides: Partial<AuditLogListItem> = {}): AuditLogListItem {
  return {
    id: 'log-1',
    actorUserId: null,
    actorEmail: 'operador@core-ti-expert.local',
    actorRole: 'ORG_OPERATOR',
    clientId: 'c1',
    clientName: 'Core TI Expert',
    clientSlug: 'core-ti-expert',
    action: 'command.enqueue',
    targetType: 'device',
    targetId: 'dev-1',
    metadata: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function actionBadge(label: string) {
  return screen.getByRole('link', { name: label })
}

describe('AuditLogTable — rótulos das ações', () => {
  it.each([
    ['command.enqueue', 'Comando remoto enfileirado'],
    ['credentials.rotate', 'Rotação de chave de inscrição'],
    ['agent_auth.revoke', 'Revogação de agente'],
    ['login', 'Login'],
    ['webhook.create', 'Criação de webhook'],
  ])('%s vira "%s"', (action, label) => {
    render(<AuditLogTable logs={[makeLog({ action })]} emptyMessage="vazio" />)

    expect(actionBadge(label)).toBeTruthy()
    expect(screen.queryByText(action)).toBeNull()
  })

  it('ação fora do catálogo continua legível pelo próprio identificador', () => {
    render(<AuditLogTable logs={[makeLog({ action: 'foo.bar' })]} emptyMessage="vazio" />)

    expect(actionBadge('foo.bar')).toBeTruthy()
  })
})

describe('AuditLogTable — tons dos badges', () => {
  it.each([
    ['device.delete', 'Exclusão de máquina', 'text-destructive'],
    ['agent_auth.revoke', 'Revogação de agente', 'text-destructive'],
    ['agent_auth.remote_uninstall', 'Desinstalação remota de agente', 'text-destructive'],
    ['credentials.view', 'Visualização de credenciais', 'text-info'],
    ['credentials.rotate', 'Rotação de chave de inscrição', 'text-info'],
    ['command.enqueue', 'Comando remoto enfileirado', 'text-warning'],
    ['command.bulk_enqueue', 'Comandos remotos em lote', 'text-warning'],
    ['login', 'Login', 'text-foreground/85'],
  ])('%s usa %s', (action, label, toneClass) => {
    render(<AuditLogTable logs={[makeLog({ action })]} emptyMessage="vazio" />)

    expect(actionBadge(label).className).toContain(toneClass)
  })

  it('acesso a credenciais não usa mais o laranja de marca', () => {
    render(<AuditLogTable logs={[makeLog({ action: 'credentials.view' })]} emptyMessage="vazio" />)

    expect(actionBadge('Visualização de credenciais').className).not.toContain('text-primary')
  })
})

describe('AuditLogTable — células que filtram o log', () => {
  it('o badge da ação aponta para ?action=', () => {
    render(<AuditLogTable logs={[makeLog({ action: 'agent_auth.remote_uninstall' })]} emptyMessage="vazio" />)

    expect(actionBadge('Desinstalação remota de agente').getAttribute('href')).toBe(
      '?action=agent_auth.remote_uninstall'
    )
  })

  it('o e-mail do operador aponta para ?actorEmail= (codificado)', () => {
    render(<AuditLogTable logs={[makeLog({ actorEmail: 'ana+ops@cliente.local' })]} emptyMessage="vazio" />)

    expect(screen.getByRole('link', { name: 'ana+ops@cliente.local' }).getAttribute('href')).toBe(
      '?actorEmail=ana%2Bops%40cliente.local'
    )
  })

  it('evento sem operador mostra "Sistema" sem link', () => {
    render(<AuditLogTable logs={[makeLog({ actorEmail: null })]} emptyMessage="vazio" />)

    expect(screen.getByText('Sistema').closest('a')).toBeNull()
  })

  it('com showTenant, o nome do tenant aponta para ?clientId=', () => {
    render(<AuditLogTable logs={[makeLog()]} emptyMessage="vazio" showTenant />)

    expect(screen.getByRole('link', { name: 'Core TI Expert' }).getAttribute('href')).toBe('?clientId=c1')
  })

  it('sem clientId, o tenant aparece sem link', () => {
    render(<AuditLogTable logs={[makeLog({ clientId: null })]} emptyMessage="vazio" showTenant />)

    expect(screen.getByText('Core TI Expert').closest('a')).toBeNull()
  })
})
