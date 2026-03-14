'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import DraggableMenuButton from '@/components/ui/DraggableMenuButton'

const NAV_ITEMS = [
  { label: '大会一覧', href: '/dashboard' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
            display: block !important;
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

      <div className="dash-hamburger" style={{ display: 'none' }}>
        <DraggableMenuButton onClick={() => setSidebarOpen(true)} storageKey="dash-hamburger-pos" />
      </div>

      {sidebarOpen && (
        <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`dash-sidebar${sidebarOpen ? ' open' : ''}`} style={{
        width: '210px', flexShrink: 0,
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--header-border)',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '180px',
          background: 'radial-gradient(ellipse at 30% 0%, var(--sidebar-glow), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid var(--header-border)' }}>
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
            <span style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 500, color: 'var(--text-on-sidebar)', letterSpacing: '0.04em' }}>
              Yitia
            </span>
          </div>
          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-dimmer)', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '4px', marginLeft: '38px' }}>
            Mahjong Taikai Manager
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: '8px 8px 4px', fontSize: '8px', fontFamily: 'monospace', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text-dimmer)', paddingTop: '16px', paddingLeft: '18px' }}>
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
                    background: isActive ? 'var(--cyan-pale)' : 'transparent',
                    color: isActive ? 'var(--nav-active-color)' : 'var(--text-dim)',
                    border: isActive ? '1px solid var(--nav-active-border)' : '1px solid transparent',
                    fontSize: '12.5px', fontWeight: isActive ? 700 : 400,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--nav-hover-bg)'
                      e.currentTarget.style.color = 'var(--nav-hover-text)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isActive ? 'var(--cyan-pale)' : 'transparent'
                    e.currentTarget.style.color = isActive ? 'var(--nav-active-color)' : 'var(--text-dim)'
                  }}
                >
                  <span>{item.label}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />
      </aside>

      {/* Main */}
      <div className="dash-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
