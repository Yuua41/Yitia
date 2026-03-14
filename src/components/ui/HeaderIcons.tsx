'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const iconBtn: React.CSSProperties = {
  width: '32px', height: '32px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'transparent', color: 'var(--mist)',
  transition: 'color 0.15s, background 0.15s',
  flexShrink: 0,
}

function hoverIn(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.color = '#00f0ff'
  e.currentTarget.style.background = 'rgba(0,240,255,0.1)'
}
function hoverOut(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.color = 'var(--mist)'
  e.currentTarget.style.background = 'transparent'
}

export default function HeaderIcons() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* 通知ベル（プレースホルダー） */}
      <button
        title="通知"
        style={{ ...iconBtn, opacity: 0.5, cursor: 'default' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
      </button>

      {/* 設定歯車（プレースホルダー） */}
      <button
        title="設定"
        style={{ ...iconBtn, opacity: 0.5, cursor: 'default' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>

      {/* アバター＋ログアウト */}
      <button
        onClick={handleLogout}
        title="ログアウト"
        style={iconBtn}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        <div style={{
          width: '26px', height: '26px',
          background: 'var(--gold)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', color: '#fff', fontWeight: 700,
        }}>A</div>
      </button>
    </div>
  )
}
