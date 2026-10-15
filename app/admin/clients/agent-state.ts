import type { StatusPillTone } from '@/components/ui/status-pill'

/**
 * RN018 (Sprint A3). Estado derivado de cada AgentAuth, sem coluna nova no
 * banco. Funcao pura: o painel a chama durante o render, nunca num efeito.
 *
 * Precedencia: revogado > bloqueado pelo cliente > registrado sem coleta > ativo.
 * - Revogado: AgentAuth.isActive = false (lib/auth.ts devolve 403).
 * - Bloqueado pelo cliente: credencial ativa, Client.isActive = false
 *   (lib/auth.ts recusa com 403 "Cliente desativado").
 * - Registrado, sem coleta: ativa e sem Device. Ou ainda nao fez o primeiro
 *   check-in, ou o Device foi excluido (o proximo check-in o recria).
 * - Ativo: ativa e com Device.
 */
export type AgentAuthStateKey = 'revoked' | 'client_blocked' | 'registered_no_collection' | 'active'

export type AgentAuthState = {
  key: AgentAuthStateKey
  label: string
  tone: StatusPillTone
  /** Explicacao curta exibida abaixo da pilula quando o rotulo nao basta. */
  detail: string | null
}

export function getAgentAuthState(input: {
  isActive: boolean
  hasDevice: boolean
  clientIsActive: boolean
}): AgentAuthState {
  if (!input.isActive) {
    return { key: 'revoked', label: 'Revogado', tone: 'neutral', detail: null }
  }

  if (!input.clientIsActive) {
    return {
      key: 'client_blocked',
      label: 'Bloqueado pelo cliente',
      tone: 'warning',
      detail: 'O cliente está desativado e o servidor recusa os envios deste agente.',
    }
  }

  if (!input.hasDevice) {
    return {
      key: 'registered_no_collection',
      label: 'Registrado, sem coleta',
      tone: 'warning',
      detail:
        'Ainda não fez o primeiro check-in, ou a máquina foi excluída e volta a aparecer no próximo check-in.',
    }
  }

  return { key: 'active', label: 'Ativo', tone: 'success', detail: null }
}
