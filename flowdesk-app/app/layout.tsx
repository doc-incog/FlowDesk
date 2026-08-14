import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

const display = Inter({
  subsets: ['latin'],
  variable: '--font-display',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'FlowDesk — Unified Campus Platform',
  description:
    'FlowDesk connects students, staff and administrators with biometric check-in, notifications, mentor and schedule management.',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5efe0' },
    { media: '(prefers-color-scheme: dark)', color: '#201c16' },
  ],
}

const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('flowdesk.theme')
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    var isDark = stored === 'dark' || (stored !== 'light' && prefersDark)
    var root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'
  } catch (e) {}
})()
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${inter.variable} ${geistMono.variable} bg-background`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
