'use client'

import { useSearchParams } from 'next/navigation'
import type { AccountOverview } from '@/app/account/actions'
import {
  AccountSettingsContent,
  isAccountTab,
  type AccountDialogTab,
  type AccountUser,
} from '@/components/account-dialog'

/**
 * Sprint V26.2: em /account a aba ativa vive na URL (`?tab=`). Com estado
 * local, o menu da conta na sidebar — que navega para `/account?tab=...` — nao
 * trocava a secao quando o usuario ja estava na pagina: o `useState` ignora a
 * prop nova. `history.replaceState` e integrado ao router do Next: atualiza
 * `useSearchParams` sem nova ida ao servidor e sem empilhar historico.
 */
export function AccountPageContent({
  user,
  initialOverview,
}: {
  user: AccountUser
  initialOverview: AccountOverview | null
}) {
  const searchParams = useSearchParams()
  const current = searchParams.get('tab')
  const tab = isAccountTab(current) ? current : 'profile'

  function handleTabChange(next: AccountDialogTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    window.history.replaceState(null, '', `?${params.toString()}`)
  }

  return (
    <AccountSettingsContent
      user={user}
      tab={tab}
      onTabChange={handleTabChange}
      initialOverview={initialOverview}
      wide
    />
  )
}
