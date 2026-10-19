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
// "Publico" aqui significa apenas "nao exige SESSAO DE USUARIO" — as rotas do
// agente continuam autenticadas por `X-Api-Key` (`validateAgentApiKey`) dentro
// do proprio handler. Toda rota nova sob /api/agent PRECISA entrar nesta lista,
// senao o proxy responde 307 para /login antes de o handler existir para o
// agente (foi exatamente o que aconteceu com /api/agent/discovery na Sprint 14,
// pego so no teste com servidor real — chamar POST() direto no Vitest nunca
// passa pelo proxy).
const publicRoutes = ["/login", "/api/auth", "/api/agent/checkin", "/api/agent/metrics", "/api/agent/discovery", "/api/agent/bootstrap", "/api/agent/bootstrap-linux", "/api/agent/register", "/api/agent/download", "/api/agent/download-exe", "/api/agent/download-linux", "/inventario-agent-linux", "/api/agent/commands", "/api/collect/windows"]

export default auth((req) => {
  const { nextUrl } = req
  const isAuthenticated = !!req.auth
  const session = req.auth

  // Redirects 308 (Permanent Redirect) das rotas antigas, anteriores a Sprint 5,
  // para os novos prefixos — preserva sub-caminho e querystring. Ficam antes de
  // qualquer checagem de autenticacao/autorizacao: uma URL antiga nao deve nem
  // chegar a expor se o usuario esta logado ou se o recurso existe, so
  // redirecionar; o pipeline de auth roda de novo na requisicao seguinte, ja
  // sob o path novo.
  if (nextUrl.pathname === "/tenant" || nextUrl.pathname.startsWith("/tenant/")) {
    const rest = nextUrl.pathname.slice("/tenant".length)
    const target = new URL(`/app${rest}`, nextUrl)
    target.search = nextUrl.search
    return NextResponse.redirect(target, 308)
  }

  if (nextUrl.pathname === "/clients" || nextUrl.pathname.startsWith("/clients/")) {
    const rest = nextUrl.pathname.slice("/clients".length)
    const target = new URL(`/admin/clients${rest}`, nextUrl)
    target.search = nextUrl.search
    return NextResponse.redirect(target, 308)
  }

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
  // trabalham em /app/[slug]; deixa-los entrar aqui so criaria uma segunda
  // rota para os mesmos dados, com regras diferentes.
  if (isAuthenticated && nextUrl.pathname.startsWith("/portal")) {
    if (!isClientViewer(getPermissionUser(session?.user))) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
  }

  // Portao GROSSEIRO de tenant. O proxy roda antes do render e nao tem banco, entao
  // nao consegue saber qual Organization e dona do slug. A autorizacao definitiva
  // acontece em `requireTenantContext`, chamado por toda pagina de tenant.
  if (isAuthenticated && nextUrl.pathname.startsWith("/app/")) {
    const segments = nextUrl.pathname.split("/")
    const targetSlug = segments[2] // /app/[targetSlug]/...
    const user = getPermissionUser(session?.user)

    if (!canPossiblyAccessTenantSlug(user, targetSlug)) {
      console.warn(`Unauthorized tenant access attempt: User ${session?.user?.email} tried to access ${targetSlug}`)
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
  }

  // Area de conta: gerir clientes e usuarios. ORG_ADMIN entra, mas so enxerga a
  // propria organizacao — o filtro por organizationId e aplicado nas paginas.
  const isAccountArea =
    nextUrl.pathname === "/admin/clients" ||
    nextUrl.pathname.startsWith("/admin/clients/") ||
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
