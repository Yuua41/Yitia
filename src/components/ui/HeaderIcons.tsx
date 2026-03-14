'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const iconBtn: React.CSSProperties = {
  width: '32px', height: '32px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'transparent', color: 'var(--mist)',
  transition: 'color 0.15s, background 0.15s',
  flexShrink: 0,
}

function hoverIn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.color = 'var(--cyan)'
  e.currentTarget.style.background = 'var(--hover-bg)'
}
function hoverOut(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.color = 'var(--mist)'
  e.currentTarget.style.background = 'transparent'
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', right: 0, marginTop: '6px',
  background: 'var(--surface)', border: '1px solid var(--border-md)',
  borderRadius: '10px', padding: '6px 0', minWidth: '180px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  zIndex: 9999,
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 16px', fontSize: '12.5px', color: 'var(--mist)',
  cursor: 'pointer', transition: 'background 0.12s',
  textDecoration: 'none', border: 'none', background: 'transparent', width: '100%',
}

export default function HeaderIcons() {
  const router = useRouter()
  const supabase = createClient()
  const [openMenu, setOpenMenu] = useState<'notification' | 'settings' | 'user' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isDark, setIsDark] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const dark = saved !== 'light'
    setIsDark(dark)
    document.body.setAttribute('data-theme', dark ? 'dark' : 'light')
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email)
    })
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.body.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setOpenMenu(null)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [openMenu])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
      {/* 通知ベル */}
      <div style={{ position: 'relative' }}>
        <button
          title="通知"
          style={iconBtn}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
          onClick={() => setOpenMenu(openMenu === 'notification' ? null : 'notification')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
        </button>
        {openMenu === 'notification' && (
          <div style={dropdownStyle}>
            <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--mist)', textAlign: 'center' }}>
              通知はありません
            </div>
          </div>
        )}
      </div>

      {/* 設定歯車 → メニュー */}
      <div style={{ position: 'relative' }}>
        <button
          title="設定"
          style={iconBtn}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
          onClick={() => setOpenMenu(openMenu === 'settings' ? null : 'settings')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        {openMenu === 'settings' && (
          <div style={dropdownStyle}>
            <button
              style={menuItemStyle}
              onClick={toggleTheme}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {isDark ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
              )}
              <span>{isDark ? 'ライトモード' : 'ダークモード'}</span>
            </button>
            <button
              style={menuItemStyle}
              onClick={() => setOpenMenu(null)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>プロフィール(未実装)</span>
            </button>
          </div>
        )}
      </div>

      {/* アバター → ログアウト確認 */}
      <div style={{ position: 'relative' }}>
        <button
          title={userEmail || 'アカウント'}
          style={iconBtn}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
          onClick={() => setOpenMenu(openMenu === 'user' ? null : 'user')}
        >
          <div style={{
            width: '26px', height: '26px',
            background: 'var(--gold)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', color: '#fff', fontWeight: 700,
          }}>A</div>
        </button>
        {openMenu === 'user' && (
          <div style={dropdownStyle}>
            {userEmail && (
              <div style={{ padding: '8px 16px 6px', fontSize: '11px', color: 'var(--mist)', fontFamily: 'monospace', borderBottom: '1px solid var(--border)', marginBottom: '4px', wordBreak: 'break-all' }}>
                {userEmail}
              </div>
            )}
            <Link
              href="/dashboard"
              style={menuItemStyle}
              onClick={() => setOpenMenu(null)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span>大会一覧</span>
            </Link>
            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
            <button
              style={menuItemStyle}
              onClick={handleLogout}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,0,100,0.1)'; e.currentTarget.style.color = '#ff6b9d' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--mist)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>ログアウト</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
