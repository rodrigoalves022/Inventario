/**
 * Rotulo das acoes auditadas. Espelha o catalogo real de `recordAuditLog` na
 * base; qualquer acao fora dele cai no proprio identificador, que continua
 * legivel ("webhook.update") em vez de sumir.
 *
 * Sprint V26.2: saiu de `components/recent-activity-panel.tsx` para um modulo
 * sem dependencias — a aba Acessos de /account (bundle da sidebar, presente em
 * toda tela) usa o mesmo catalogo sem arrastar o zod do painel junto.
 */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  login: 'Login',
  'credentials.view': 'Visualização de credenciais',
  'credentials.rotate': 'Rotação de chave de inscrição',
  'device.delete': 'Exclusão de máquina',
  'client.create': 'Criação de cliente',
  'agent_auth.revoke': 'Revogação de agente',
  'agent_auth.register': 'Registro de agente',
  'alert_rule.create': 'Criação de regra de alerta',
  'alert_rule.delete': 'Exclusão de regra de alerta',
  'command.enqueue': 'Comando remoto enfileirado',
  'command.bulk_enqueue': 'Comandos remotos em lote',
  'command.result': 'Resultado de comando remoto',
  'webhook.create': 'Criação de webhook',
  'webhook.update': 'Atualização de webhook',
  'webhook.toggle': 'Webhook ativado/desativado',
  'tenant.discovery_enabled': 'Varredura de rede ativada',
  'tenant.discovery_disabled': 'Varredura de rede desativada',
  'account.email_update': 'Alteração de e-mail da conta',
  'account.name_update': 'Alteração de nome da conta',
  'account.password_change': 'Alteração de senha da conta',
}

export function formatAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action
}
