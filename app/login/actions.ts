"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function loginUser(prevState: any, formData: FormData) {
  try {
    await signIn("credentials", formData)
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
