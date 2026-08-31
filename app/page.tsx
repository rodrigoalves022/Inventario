import { redirect } from 'next/navigation'

export default function LegacyInventoryRouteRedirect() {
  redirect('/admin/clients')
}
