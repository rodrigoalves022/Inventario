'use client'

import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function PortalSignOutButton() {
  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={() => signOut({ callbackUrl: '/login' })}>
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  )
}
