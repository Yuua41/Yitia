'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 60% at 30% 20%, rgba(173,165,130,0.12) 0%, transparent 60%), var(--navy)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '16px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px',
              background: 'linear-gradient(135deg, #c8c5a0, #AD82A9 180%)',
              borderRadius: '8px',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)',
              padding: '6px', gap: '1.5px',
            }}>
              {[1,0,1,0,1,0,1,0,1].map((show, i) => (
                <div key={i} style={{
                  borderRadius: '50%',
                  background: show ? '#1a2f2d' : 'transparent',
                  opacity: show ? 0.82 : 0,
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '26px', fontWeight: 500, color: 'var(--ink)', letterSpacing: '0.04em' }}>
              Yitia
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--mist)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '6px' }}>
            Mahjong Taikai Manager
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--slate)', marginBottom: '6px' }}>
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '11px 14px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '12px', fontSize: '14px', color: 'var(--ink)', outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--slate)', marginBottom: '6px' }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '11px 14px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '12px', fontSize: '14px', color: 'var(--ink)', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: '12px', color: 'var(--red)', background: 'var(--red-pale)', padding: '8px 12px', borderRadius: '7px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px',
              background: loading ? 'var(--mist)' : 'linear-gradient(135deg, #ADA582, #7A7455)',
              color: '#fff', border: 'none', borderRadius: '12px',
              fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px', letterSpacing: '0.01em',
            }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--mist)', marginTop: '14px' }}>
          アカウント登録は管理者にお問い合わせください
        </p>
      </div>
    </div>
  )
}
