'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
        className,
      )}
      {...props}
    />
  )
}

const TRIGGER_VARIANT_CLASS = {
  /** Abas lado a lado dentro do trilho `bg-muted` (padrao shadcn). */
  segmented:
    "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all duration-150 focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm data-[state=inactive]:cursor-pointer data-[state=inactive]:hover:bg-accent/60 data-[state=inactive]:hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  /**
   * Sprint V26.2: secao de pagina de configuracao (menu vertical de /account).
   * Linha inteira, icone + rotulo, ativo tingido de primary. Nao herda as
   * variantes `dark:` do segmentado: `dark:data-[state=active]:bg-input/30`
   * venceria o tom ativo por especificidade no tema escuro.
   */
  nav: "flex w-full items-center justify-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=inactive]:cursor-pointer data-[state=inactive]:hover:bg-accent/60 data-[state=inactive]:hover:text-accent-foreground data-[state=active]:border-primary/30 data-[state=active]:bg-primary/10 data-[state=active]:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
} as const

function TabsTrigger({
  className,
  variant = 'segmented',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { variant?: keyof typeof TRIGGER_VARIANT_CLASS }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(TRIGGER_VARIANT_CLASS[variant], className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
