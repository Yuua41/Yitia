'use client'

import { useState } from 'react'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        .dash-hamburger { display: none; }
        .dash-overlay { display: none; }
        @media (max-width: 768px) {
          .dash-sidebar {
            position: fixed !important;
            left: 0; top: 0; bottom: 0;
            z-index: 1000;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .dash-sidebar.open {
            transform: translateX(0);
          }
          .dash-hamburger {
            display: flex !important;
            position: fixed;
            bottom: 10px; left: 10px;
            z-index: 999;
            width: 40px; height: 40px;
            align-items: center; justify-content: center;
            background: var(--navy);
            border: 1px solid rgba(173,165,130,0.4);
            border-radius: 8px;
            color: #c8c5a0;
            font-size: 22px;
            cursor: pointer;
          }
          .dash-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 999;
            background: rgba(0,0,0,0.5);
          }
          .dash-main {
            margin-left: 0 !important;
          }
        }
      `}</style>

      <button
        className="dash-hamburger"
        onClick={() => setSidebarOpen(true)}
        style={{ display: 'none' }}
      >
        ☰
      </button>

      {sidebarOpen && (
        <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`dash-sidebar${sidebarOpen ? ' open' : ''}`} style={{
        width: '210px', flexShrink: 0,
        background: 'var(--navy)',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '180px',
          background: 'radial-gradient(ellipse at 30% 0%, rgba(173,165,130,0.18), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px',
              background: 'linear-gradient(135deg, #c8c5a0, #AD82A9 160%)',
              borderRadius: '7px',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)',
              padding: '5px', gap: '1.5px',
              boxShadow: '0 2px 8px rgba(173,165,130,0.35)',
            }}>
              {[1,0,1,0,1,0,1,0,1].map((show, i) => (
                <div key={i} style={{
                  borderRadius: '50%',
                  background: show ? '#1a2f2d' : 'transparent',
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
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} onClick={() => setSidebarOpen(false)}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px',
                    marginBottom: '1px', cursor: 'pointer',
                    background: isActive ? 'rgba(173,165,130,0.22)' : 'transparent',
                    color: isActive ? '#e8d8e7' : 'rgba(255,255,255,0.50)',
                    border: isActive ? '1px solid rgba(173,165,130,0.30)' : '1px solid transparent',
                    fontSize: '12.5px', fontWeight: isActive ? 700 : 400,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.09)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                    } else {
                      e.currentTarget.style.background = 'rgba(173,165,130,0.32)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isActive ? 'rgba(173,165,130,0.22)' : 'transparent'
                    e.currentTarget.style.color = isActive ? '#e8d8e7' : 'rgba(255,255,255,0.50)'
                  }}
                >
                  <span>{item.label}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
          }}>
            <div style={{
              width: '24px', height: '24px', background: 'var(--gold)',
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
      <div className="dash-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
