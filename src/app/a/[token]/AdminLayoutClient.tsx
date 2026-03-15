'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import DraggableMenuButton from '@/components/ui/DraggableMenuButton'
import type { Tournament } from '@/types'

interface Props {
  children: React.ReactNode
  tournament: Tournament
  token: string
}

export default function AdminLayoutClient({ children, tournament, token }: Props) {
  const pathname = usePathname()
  const base = `/a/${token}`
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { label: '卓組・成績入力', href: `${base}/schedule` },
    { label: '全体成績', href: `${base}/standings` },
    { label: 'QRコード', href: `${base}/qr` },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        .admin-hamburger { display: none; }
        .admin-overlay { display: none; }
        @media (max-width: 768px) {
          .admin-sidebar {
            position: fixed !important;
            left: 0; top: 0; bottom: 0;
            z-index: 1000;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .admin-sidebar.open {
            transform: translateX(0);
          }
          .admin-hamburger {
            display: block !important;
          }
          .admin-overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 999;
            background: rgba(0,0,0,0.5);
          }
          .admin-main {
            margin-left: 0 !important;
          }
        }
      `}</style>

      <div className="admin-hamburger" style={{ display: 'none' }}>
        <DraggableMenuButton onClick={() => setSidebarOpen(true)} storageKey="admin-hamburger-pos" />
      </div>

      {sidebarOpen && (
        <div className="admin-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{
        width: '210px', flexShrink: 0,
        background: 'var(--sidebar-bg, var(--header-bg))',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--sidebar-border, var(--header-border))',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '180px',
          background: 'radial-gradient(ellipse at 30% 0%, var(--sidebar-glow), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid var(--sidebar-border, var(--header-border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px',
              background: 'linear-gradient(135deg, var(--logo-from), var(--logo-to) 160%)',
              borderRadius: '7px',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)',
              padding: '5px', gap: '1.5px',
              boxShadow: `0 2px 12px var(--logo-shadow)`,
            }}>
              {[1,0,1,0,1,0,1,0,1].map((show, i) => (
                <div key={i} style={{
                  borderRadius: '50%',
                  background: show ? 'var(--logo-dot)' : 'transparent',
                  opacity: show ? 0.82 : 0,
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 500, color: 'var(--text-on-sidebar)', letterSpacing: '0.04em' }}>Yitia</span>
          </div>
          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dimmer)', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '4px', marginLeft: '38px' }}>
            Mahjong Taikai Manager
          </div>
        </div>
        <div style={{ padding: '12px 18px 8px' }}>
          <div style={{ fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text-dimmer)', marginBottom: '6px' }}>現在の大会</div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>{tournament.name}<span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '100px', fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em', background: tournament.status === 'ongoing' ? 'var(--cyan-pale)' : tournament.status === 'finished' ? 'var(--gold-pale)' : 'var(--hover-bg)', color: tournament.status === 'ongoing' ? 'var(--cyan)' : tournament.status === 'finished' ? 'var(--gold)' : 'var(--mist)' }}>{tournament.status === 'ongoing' ? '進行中' : tournament.status === 'finished' ? '完了' : '下書き'}</span></div>
        </div>
        <div style={{ height: '1px', background: 'var(--header-border)', margin: '4px 0' }} />
        <div style={{ padding: '4px 8px', marginTop: '4px' }}>
          <div style={{ fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-dimmer)', padding: '8px 10px 4px' }}>管理</div>
          {navItems.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} onClick={() => setSidebarOpen(false)}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px', marginBottom: '1px',
                    background: active ? 'var(--cyan-pale)' : 'transparent',
                    color: active ? 'var(--nav-active-color)' : 'var(--text-dim)',
                    border: active ? '1px solid var(--nav-active-border)' : '1px solid transparent',
                    fontSize: '12.5px', fontWeight: active ? 700 : 400, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--nav-hover-bg)'
                      e.currentTarget.style.color = 'var(--nav-hover-text)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = active ? 'var(--cyan-pale)' : 'transparent'
                    e.currentTarget.style.color = active ? 'var(--nav-active-color)' : 'var(--text-dim)'
                  }}
                >
                  <span>{item.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--header-border)' }}>
          <div style={{ padding: '6px 10px', color: 'var(--text-dimmer)', fontSize: '10px', fontFamily: 'monospace' }}>
            管理者アクセス
          </div>
        </div>
      </aside>
      <div className="admin-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
