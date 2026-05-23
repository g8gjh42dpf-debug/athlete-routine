import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Athlete Routine',
  description: 'Ta routine quotidienne d\'athlète',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Athlete' },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: '#0a0a0f', color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
