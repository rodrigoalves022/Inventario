import Link from 'next/link'
import { Monitor } from 'lucide-react'
import { requirePortalContext } from '@/lib/portal-context'
import { PortalSignOutButton } from '@/components/portal-sign-out-button'

/**
 * Shell proprio do portal: nao reaproveita a Sidebar de operacao de proposito.
 * A superficie do cliente nao deve carregar componentes que sabem excluir
 * maquina, ver credencial ou disparar comando.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePortalContext()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/portal" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Monitor className="h-5 w-5 text-primary-foreground" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{context.clientName}</span>
              <span className="block text-xs text-muted-foreground">Inventário de TI</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <nav aria-label="Portal" className="flex items-center gap-4">
              {[
                { href: '/portal', label: 'Dispositivos' },
                { href: '/portal/software', label: 'Softwares' },
                { href: '/portal/peripherals', label: 'Periféricos' },
                { href: '/portal/reports', label: 'Relatórios' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {context.viewerName || context.viewerEmail}
            </span>
            <PortalSignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
