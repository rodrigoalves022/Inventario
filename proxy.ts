import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"
import {
  canAccessGlobalAdmin,
  canPossiblyAccessTenantSlug,
  getPermissionUser,
  isClientViewer,
  isOrgAdmin,
} from "@/lib/permissions"

// Usa só authConfig (sem CredentialsProvider/bcryptjs) para manter o bundle do
// proxy enxuto — Proxy roda em runtime Node.js por padrão desde o Next.js 16,
// então isso não é mais requisito de Edge Runtime, só disciplina de tamanho.
const { auth } = NextAuth(authConfig)

// List of public routes that don't need authentication
const publicRoutes = ["/login", "/api/auth", "/api/agent/checkin", "/api/agent/metrics", "/api/agent/bootstrap", "/api/agent/register", "/api/agent/download", "/api/agent/download-exe", "/api/agent/commands", "/api/collect/windows"]

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

  // O portal e superficie exclusiva do cliente. Operadores e admins de conta
  // trabalham em /tenant/[slug]; deixa-los entrar aqui so criaria uma segunda
  // rota para os mesmos dados, com regras diferentes.
  if (isAuthenticated && nextUrl.pathname.startsWith("/portal")) {
    if (!isClientViewer(getPermissionUser(session?.user))) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
  }

  // Portao GROSSEIRO de tenant. O proxy roda antes do render e nao tem banco, entao
  // nao consegue saber qual Organization e dona do slug. A autorizacao definitiva
  // acontece em `requireTenantContext`, chamado por toda pagina de tenant.
  if (isAuthenticated && nextUrl.pathname.startsWith("/tenant/")) {
    const segments = nextUrl.pathname.split("/")
    const targetSlug = segments[2] // /tenant/[targetSlug]/...
    const user = getPermissionUser(session?.user)

    if (!canPossiblyAccessTenantSlug(user, targetSlug)) {
      console.warn(`Unauthorized tenant access attempt: User ${session?.user?.email} tried to access ${targetSlug}`)
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
  }

  // Area de conta: gerir clientes e usuarios. ORG_ADMIN entra, mas so enxerga a
  // propria organizacao — o filtro por organizationId e aplicado nas paginas.
  const isAccountArea =
    nextUrl.pathname === "/clients" ||
    nextUrl.pathname.startsWith("/clients/") ||
    nextUrl.pathname.startsWith("/api/clients") ||
    nextUrl.pathname === "/users"

  // Area exclusiva da plataforma.
  const isPlatformArea = nextUrl.pathname === "/security"

  if (isAuthenticated && (isAccountArea || isPlatformArea)) {
    const user = getPermissionUser(session?.user)
    const allowed = isPlatformArea
      ? canAccessGlobalAdmin(user)
      : canAccessGlobalAdmin(user) || isOrgAdmin(user)

    if (!allowed) {
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
