import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

export const dynamic = 'force-dynamic'

/**
 * Inter para a interface e JetBrains Mono para valores tecnicos (chaves, IPs,
 * versoes, seriais). Antes o CSS apontava para 'Geist', que nunca era
 * carregada e nao tinha fallback generico — o navegador caia na fonte padrao
 * dele, serifada, o que deixava todo o painel com cara de documento.
 *
 * `display: swap` evita texto invisivel enquanto a fonte carrega.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  fallback: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'monospace'],
})

export const metadata: Metadata = {
  title: 'Inventário TI',
  description: 'Sistema de inventário de ativos de TI',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

const ACCENT_BOOT_SCRIPT = `try{var a=localStorage.getItem('inventario-accent');document.documentElement.dataset.accent=/^(orange|blue|emerald|pink|violet|mono)$/.test(a)?a:'orange'}catch(e){document.documentElement.dataset.accent='orange'}`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning: o script do next-themes poe a classe do tema no
    // <html> antes da hidratacao (e' o que evita o flash), entao o atributo
    // diverge do SSR de proposito.
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Sprint V23: aplica a cor de destaque salva antes da primeira pintura
            (mesma estrategia do next-themes para a classe do tema). */}
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
