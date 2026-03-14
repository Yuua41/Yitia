import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Noto_Sans_JP } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
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
      <body className={`${geist.variable} ${notoSansJP.variable}`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='light')document.body.setAttribute('data-theme','light')})()` }} />
        {children}
      </body>
    </html>
  )
}
