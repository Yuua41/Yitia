'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SettingsClient() {
  const router = useRouter()
  const supabase = createClient()

  // Theme
  const [isDark, setIsDark] = useState(true)
  useEffect(() => {
    setIsDark(document.body.getAttribute('data-theme') !== 'light')
  }, [])

  function toggleTheme() {
    const next = isDark ? 'light' : 'dark'
    if (next === 'light') {
      document.body.setAttribute('data-theme', 'light')
      localStorage.setItem('theme', 'light')
    } else {
      document.body.removeAttribute('data-theme')
      localStorage.setItem('theme', 'dark')
    }
    setIsDark(!isDark)
  }

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDeleteAccount() {
    if (!deletePassword) return
    if (!window.confirm('本当にアカウントを削除しますか？\nすべての大会データが完全に削除され、元に戻すことはできません。')) return
    setDeleting(true)
    setDeleteError('')
    const res = await fetch('/api/account/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword }),
    })
    if (!res.ok) {
      const data = await res.json()
      setDeleteError(data.error || '削除に失敗しました')
      setDeleting(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        height: '56px',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--header-border)',
        padding: '0 26px', display: 'flex', alignItems: 'center', flexShrink: 0,
      }}>
        <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' }}>設定</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 26px' }}>
        <div style={{ maxWidth: '480px' }}>

          {/* Theme */}
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--ink)' }}>テーマ</h2>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', border: '1px solid var(--border-md)',
            borderRadius: '12px', padding: '14px 16px',
          }}>
            <span style={{ fontSize: '14px', color: 'var(--ink)' }}>
              {isDark ? 'ナイトモード' : 'ライトモード'}
            </span>
            <button
              onClick={toggleTheme}
              style={{
                width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                background: isDark ? 'var(--cyan-deep)' : 'var(--border-md)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                position: 'absolute', top: '3px',
                left: isDark ? '25px' : '3px',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '32px 0' }} />

          {/* Account Deletion */}
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--red)' }}>アカウント削除</h2>
          <p style={{ fontSize: '13px', color: 'var(--mist)', marginBottom: '16px', lineHeight: 1.6 }}>
            アカウントを削除すると、すべての大会データが完全に削除されます。この操作は取り消せません。
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '10px 20px',
                background: 'transparent', border: '1px solid var(--red)',
                borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                color: 'var(--red)', cursor: 'pointer',
              }}
            >
              アカウントを削除する
            </button>
          ) : (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--red)',
              borderRadius: '12px', padding: '20px',
            }}>
              <p style={{ fontSize: '13px', color: 'var(--ink)', marginBottom: '12px', lineHeight: 1.6 }}>
                確認のため、現在のパスワードを入力してください。
              </p>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="パスワード"
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'var(--card-bg)', border: '1px solid var(--border-md)',
                  borderRadius: '12px', fontSize: '14px', color: 'var(--ink)', outline: 'none',
                  marginBottom: '12px',
                }}
              />
              {deleteError && (
                <div style={{
                  fontSize: '12px', color: 'var(--red)', background: 'var(--red-pale)',
                  padding: '8px 12px', borderRadius: '7px', marginBottom: '12px',
                }}>
                  {deleteError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }}
                  style={{
                    padding: '10px 20px', background: 'var(--surface)',
                    border: '1px solid var(--border-md)', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={!deletePassword || deleting}
                  style={{
                    padding: '10px 20px',
                    background: deletePassword && !deleting ? 'var(--red)' : 'var(--mist)',
                    border: 'none', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 600, color: '#fff',
                    cursor: deletePassword && !deleting ? 'pointer' : 'not-allowed',
                  }}
                >
                  {deleting ? '削除中...' : '削除を実行'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
