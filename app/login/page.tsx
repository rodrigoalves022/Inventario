"use client"

import { useActionState } from "react"
import { loginUser } from "./actions"
import { Shield, KeyRound, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginUser, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[128px]" />
      </div>

      <div className="z-10 w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight">Inventario Enterprise</h1>
          <p className="text-zinc-400 mt-2 text-sm">Acesse o painel de gerenciamento corporativo</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6 shadow-2xl">
          <form action={formAction} className="flex flex-col space-y-4">
            {state?.error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center">
                <span className="shrink-0 animate-pulse mr-2">⚠️</span>
                {state.error}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                E-mail
              </label>
              <input 
                type="email" 
                name="email"
                required
                placeholder="admin@empresa.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <input 
                  type="password" 
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-600"
                />
                <KeyRound className="absolute right-3 top-3 w-5 h-5 text-zinc-600" />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isPending}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Autenticando...
                </>
              ) : (
                "Entrar no Painel"
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center text-xs text-zinc-600 mt-8">
          Acesso restrito. Todas as atividades são monitoradas.
        </p>
      </div>
    </div>
  )
}
