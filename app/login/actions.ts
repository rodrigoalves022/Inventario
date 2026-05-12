"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

type LoginState = { error: string } | null

export async function loginUser(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", formData)
    return null
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Credenciais inválidas." }
        default:
          return { error: "Ocorreu um erro ao tentar fazer login." }
      }
    }
    throw error // required for Next.js redirects
  }
}
