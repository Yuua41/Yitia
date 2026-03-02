'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Tournament } from '@/types'

interface Props {
  children: React.ReactNode
  tournament: Tournament
}

export default function TournamentLayoutClient({ children, tournament }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const base = `/tournament/${tournament.id}`

  const navItems = [
    { label: '卓組', icon: '📋', href: `${base}/schedule` },
    { label: '成績', icon: '📊', href: `${base}/standings` },
    { label: 'QRコード', icon: '📱', href: `${base}/qr` },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: '210px', flexShrink: 0,
        background: 'var(--navy)',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '180px',
          background: 'radial-gradient(ellipse at 30% 0%, rgba(14,165,233,0.22), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '30px', height: '30px',
                background: 'linear-gradient(135deg, #0ea5e9, #f59e0b 160%)',
                borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'serif', fontSize: '16px', fontWeight: 900, color: 'var(--navy)',
              }}>一</div>
              <span style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 500, color: '#fff', letterSpacing: '0.04em' }}>Yitia</span>
            </div>
          </Link>
          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '4px', marginLeft: '38px' }}>
            Tournament v1.0
          </div>
        </div>
        <div style={{ padding: '12px 18px 8px' }}>
          <div style={{ fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '6px' }}>現在の大会</div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35 }}>{tournament.name}</div>
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
        <div style={{ padding: '4px 8px', marginTop: '4px' }}>
          <div style={{ fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', padding: '8px 10px 4px' }}>管理</div>
          {navItems.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '8px', marginBottom: '1px',
                  background: active ? 'rgba(14,165,233,0.22)' : 'transparent',
                  color: active ? '#38bdf8' : 'rgba(255,255,255,0.42)',
                  border: active ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                  fontSize: '12.5px', fontWeight: 500, transition: 'all 0.13s',
                }}>
                  <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.35)', fontSize: '11.5px' }}>
              ← 大会一覧に戻る
            </div>
          </Link>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '6px 10px', background: 'none', border: 'none',
            cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '11.5px', textAlign: 'left',
          }}>ログアウト</button>
        </div>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
