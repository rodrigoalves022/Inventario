'use client'

import { Fragment } from 'react'
import Link from 'next/link'

import type { ShellCrumb } from '@/lib/shell-navigation'
import { cn } from '@/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

/**
 * Trilha do header: `Clientes > <Cliente> > <Página ativa>`.
 *
 * Decisoes:
 *
 * 1. NAO existe um `<h2>` de titulo alem da trilha. O ultimo nivel JA e o
 *    nome da pagina; imprimir a mesma palavra duas vezes, uma grande e uma
 *    pequena, e ruido. O peso resolve a hierarquia: ancestrais em
 *    `text-sm text-muted-foreground`, nivel atual em
 *    `text-base font-semibold text-foreground`.
 *
 * 2. Um nivel sem `href` vira TEXTO, nao um link desabilitado. E assim que o
 *    "Clientes" chega pra quem nao pode abrir `/admin/clients` (ORG_OPERATOR
 *    e afins) — a trilha continua explicando onde o usuario esta sem oferecer
 *    um caminho que terminaria em 403. Quem decide isso e
 *    `getBreadcrumbTrail`, nao este componente.
 *
 * 3. Em tela estreita sobrevivem o nivel atual e o pai imediato — que num
 *    tenant e o nome do CLIENTE. Colapso estrutural, nao tipografia fluida:
 *    a trilha inteira quebraria em duas linhas dentro de um header de 64px.
 *    Guardar o pai (e nao so a pagina) e o que impede o caso mais perigoso de
 *    um painel multi-tenant no celular: olhar dados sem saber de quem sao.
 */
export function ShellBreadcrumbs({ trail, className }: { trail: ShellCrumb[]; className?: string }) {
  if (trail.length === 0) return null

  const ancestors = trail.slice(0, -1)
  const current = trail[trail.length - 1]

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList className="flex-nowrap gap-1.5 sm:gap-2">
        {/* Separador e IRMAO do item, nunca filho: `BreadcrumbSeparator` e um
            <li>, e <li> dentro de <li> nao e HTML valido. */}
        {ancestors.map((crumb, index) => {
          // Abaixo de `md`, so o pai imediato do nivel atual continua visivel.
          const collapses = index < ancestors.length - 1
          return (
          <Fragment key={`${crumb.label}-${index}`}>
            <BreadcrumbItem className={cn('min-w-0', collapses ? 'hidden md:inline-flex' : 'inline-flex')}>
              {crumb.href ? (
                <BreadcrumbLink
                  asChild
                  className="truncate rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <span className="truncate text-sm text-muted-foreground">{crumb.label}</span>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator
              className={cn('text-muted-foreground/60', collapses ? 'hidden md:inline-flex' : 'inline-flex')}
            />
          </Fragment>
          )
        })}

        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate text-base font-semibold text-foreground">
            {current.label}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
