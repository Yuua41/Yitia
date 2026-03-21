'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface PendingNotification {
  tournamentId: string
  tournamentName: string
  roundNumber: number
  tableNumber: number
}

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
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [notifications, setNotifications] = useState<PendingNotification[]>([])

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('owner_id', user.id)
      .eq('status', 'ongoing')

    if (!tournaments || tournaments.length === 0) {
      setNotifications([])
      return
    }

    const { data: tables } = await supabase
      .from('tables')
      .select('tournament_id, round_number, table_number')
      .in('tournament_id', tournaments.map(t => t.id))
      .eq('is_submitted', true)
      .eq('is_validated', false)

    if (!tables || tables.length === 0) {
      setNotifications([])
      return
    }

    const tMap = new Map(tournaments.map(t => [t.id, t.name]))
    setNotifications(tables.map(t => ({
      tournamentId: t.tournament_id,
      tournamentName: tMap.get(t.tournament_id) ?? '',
      roundNumber: t.round_number,
      tableNumber: t.table_number,
    })))
  }, [supabase])

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const dark = saved !== 'light'
    setIsDark(dark)
    document.body.setAttribute('data-theme', dark ? 'dark' : 'light')
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email)
    })
    fetchNotifications()
  }, [])

  // ページ遷移時・フォーカス時に再取得
  useEffect(() => { fetchNotifications() }, [pathname, fetchNotifications])
  useEffect(() => {
    const onFocus = () => fetchNotifications()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchNotifications])

  // 30秒ごとにポーリング
  useEffect(() => {
    const id = setInterval(fetchNotifications, 30000)
    return () => clearInterval(id)
  }, [fetchNotifications])

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
          {notifications.length > 0 && (
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              width: '16px', height: '16px', borderRadius: '50%',
              background: '#ef4444', color: '#fff',
              fontSize: '9px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, border: '2px solid var(--header-bg)',
            }}>{notifications.length > 9 ? '9+' : notifications.length}</span>
          )}
        </button>
        {openMenu === 'notification' && (
          <div style={{ ...dropdownStyle, minWidth: '260px', maxHeight: '320px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--mist)', textAlign: 'center' }}>
                通知はありません
              </div>
            ) : (
              notifications.map((n, i) => (
                <button
                  key={`${n.tournamentId}-${n.roundNumber}-${n.tableNumber}`}
                  style={{ ...menuItemStyle, flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}
                  onClick={() => {
                    setOpenMenu(null)
                    router.push(`/tournament/${n.tournamentId}/schedule`)
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)' }}>
                    R{n.roundNumber} 卓{n.tableNumber} — 確定待ち
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--mist)' }}>{n.tournamentName}</span>
                </button>
              ))
            )}
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
