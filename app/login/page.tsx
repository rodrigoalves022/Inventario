"use client"

import { useActionState } from "react"
import { loginUser } from "./actions"
import { Shield, KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginUser, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />
      </div>

      <div className="z-10 w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-card border rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight">Inventario Enterprise</h1>
          <p className="text-muted-foreground mt-2 text-sm">Acesse o painel de gerenciamento corporativo</p>
        </div>

        <Card className="p-6 backdrop-blur-xl shadow-2xl">
          <form action={formAction} className="flex flex-col space-y-4">
            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                name="email"
                required
                placeholder="admin@empresa.com"
                className="h-11"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="h-11 pr-10"
                />
                <KeyRound className="absolute right-3 top-3 w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            <Button type="submit" disabled={isPending} size="lg" className="mt-2 w-full">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Entrar no Painel"
              )}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Acesso restrito. Todas as atividades são monitoradas.
        </p>
      </div>
    </div>
  )
}
