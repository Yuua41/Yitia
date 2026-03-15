import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import { M_PLUS_1p } from 'next/font/google'
import './globals.css'

const ibmPlex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-en' })
const mplus = M_PLUS_1p({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jp',
  display: 'swap',
})


export const metadata: Metadata = {
  title: 'Yitia — 麻雀大会管理',
  description: '麻雀大会管理システム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={`${ibmPlex.variable} ${mplus.variable}`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='light')document.body.setAttribute('data-theme','light')})()` }} />
        {children}
      </body>
    </html>
  )
}
