import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
}) 

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'CampusFlow — Unified Campus Platform',
  description:
    'CampusFlow connects students, staff and administrators with biometric check-in, notifications, mentor and schedule management.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4fb' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],op
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
