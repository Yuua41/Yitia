'use client'

import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const NAV_ITEMS = [
  { label: '大会一覧', href: '/dashboard' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
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

        {/* Logo */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px',
              background: 'linear-gradient(135deg, #0ea5e9, #f59e0b 160%)',
              borderRadius: '7px',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)',
              padding: '5px', gap: '1.5px',
              boxShadow: '0 2px 8px rgba(14,165,233,0.45)',
            }}>
              {[1,0,1,0,1,0,1,0,1].map((show, i) => (
                <div key={i} style={{
                  borderRadius: '50%',
                  background: show ? '#0f1e3c' : 'transparent',
                  opacity: show ? 0.82 : 0,
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 500, color: '#fff', letterSpacing: '0.04em' }}>
              Yitia
            </span>
          </div>
          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '4px', marginLeft: '38px' }}>
            Mahjong Taikai Manager
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: '8px 8px 4px', fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', paddingTop: '16px', paddingLeft: '18px' }}>
          大会
        </div>
        <nav style={{ padding: '4px 8px', flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '8px',
                marginBottom: '1px', cursor: 'pointer',
                background: pathname === item.href ? 'rgba(14,165,233,0.22)' : 'transparent',
                color: pathname === item.href ? '#38bdf8' : 'rgba(255,255,255,0.42)',
                border: pathname === item.href ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                fontSize: '12.5px', fontWeight: 500,
                transition: 'all 0.13s',
              }}>
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
          }}>
            <div style={{
              width: '24px', height: '24px', background: 'var(--cyan-deep)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', color: '#fff', fontWeight: 700, flexShrink: 0,
            }}>A</div>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '11px', color: 'rgba(255,255,255,0.45)',
                textAlign: 'left', flex: 1,
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
