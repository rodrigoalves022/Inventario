import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { canAccessGlobalAdmin, canAccessTenant, getPermissionUser } from "@/lib/permissions"

// List of public routes that don't need authentication
const publicRoutes = ["/login", "/api/agent/checkin", "/api/agent/bootstrap", "/api/agent/register", "/api/agent/download", "/api/collect/windows"]

export default auth((req) => {
  const { nextUrl } = req
  const isAuthenticated = !!req.auth
  const session = req.auth

  const isPublicRoute = publicRoutes.some(
    (route) => nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)
  )

  // Redirect to dashboard if logged in and accessing login or root
  if (isAuthenticated && (nextUrl.pathname === "/login" || nextUrl.pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  // If it's a private route and user is NOT authenticated, redirect to login
  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // Tenant Isolation logic
  if (isAuthenticated && nextUrl.pathname.startsWith("/tenant/")) {
    const segments = nextUrl.pathname.split("/")
    const targetSlug = segments[2] // /tenant/[targetSlug]/...
    const user = getPermissionUser(session?.user)

    // Only allow access if SUPER_ADMIN or if slugs match
    if (!canAccessTenant(user, targetSlug)) {
      console.warn(`Unauthorized tenant access attempt: User ${session?.user?.email} (${user.clientSlug}) tried to access ${targetSlug}`)
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
  }

  // Protect /clients and other global admin routes
  if (
    isAuthenticated &&
    (
      nextUrl.pathname === "/clients" ||
      nextUrl.pathname.startsWith("/clients/") ||
      nextUrl.pathname.startsWith("/api/clients") ||
      nextUrl.pathname === "/users" ||
      nextUrl.pathname === "/security" ||
      nextUrl.pathname === "/settings"
    )
  ) {
    const user = getPermissionUser(session?.user)
    if (!canAccessGlobalAdmin(user)) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|exe)$).*)",
  ],
}
