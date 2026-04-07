'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login'

  useEffect(() => {
    document.body.setAttribute('data-theme', 'light')
  }, [])
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)

  function switchMode() {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError('')
    setSuccess('')
  }

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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!/^[a-zA-Z0-9]{8,}$/.test(password)) {
      setError('パスワードは英数字8文字以上で入力してください')
      return
    }
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError('登録に失敗しました: ' + error.message)
      setLoading(false)
      return
    }

    setSuccess('確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--paper)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--card-bg)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid var(--card-border)',
        borderRadius: '16px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.15), inset 0 1px 0 var(--border)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px',
              background: 'linear-gradient(135deg, var(--logo-from), var(--logo-to) 180%)',
              boxShadow: `0 2px 12px var(--logo-shadow)`,
              borderRadius: '8px',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)',
              padding: '6px', gap: '1.5px',
            }}>
              {[1,0,1,0,1,0,1,0,1].map((show, i) => (
                <div key={i} style={{
                  borderRadius: '50%',
                  background: show ? 'var(--logo-dot)' : 'transparent',
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

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
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
                background: 'var(--surface)', border: '1px solid var(--border-md)',
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
              placeholder={mode === 'register' ? '英数字8文字以上' : ''}
              style={{
                width: '100%', padding: '11px 14px',
                background: 'var(--surface)', border: '1px solid var(--border-md)',
                borderRadius: '12px', fontSize: '14px', color: 'var(--ink)', outline: 'none',
              }}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--slate)', marginBottom: '6px' }}>
                パスワード（確認）
              </label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                required
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'var(--surface)', border: '1px solid var(--border-md)',
                  borderRadius: '12px', fontSize: '14px', color: 'var(--ink)', outline: 'none',
                }}
              />
            </div>
          )}

          {error && (
            <div style={{ fontSize: '12px', color: 'var(--red)', background: 'var(--red-pale)', padding: '8px 12px', borderRadius: '7px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ fontSize: '12px', color: 'var(--cyan-deep)', background: 'var(--cyan-pale)', padding: '8px 12px', borderRadius: '7px' }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px',
              background: loading ? 'var(--mist)' : 'linear-gradient(135deg, var(--cyan-deep), var(--cyan) 180%)',
              boxShadow: loading ? 'none' : '0 2px 12px var(--focus-shadow)',
              color: '#fff', border: 'none', borderRadius: '12px',
              fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px', letterSpacing: '0.01em',
            }}
          >
            {loading
              ? (mode === 'login' ? 'ログイン中...' : '登録中...')
              : (mode === 'login' ? 'ログイン' : 'アカウント登録')}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--mist)', marginTop: '16px' }}>
          {mode === 'login' ? (
            <>アカウントをお持ちでない方は<button onClick={switchMode} style={{ background: 'none', border: 'none', color: 'var(--cyan-deep)', fontWeight: 600, cursor: 'pointer', fontSize: '12px', padding: 0 }}>新規登録</button></>
          ) : (
            <>アカウントをお持ちの方は<button onClick={switchMode} style={{ background: 'none', border: 'none', color: 'var(--cyan-deep)', fontWeight: 600, cursor: 'pointer', fontSize: '12px', padding: 0 }}>ログイン</button></>
          )}
        </p>
      </div>
      <div style={{ position: 'fixed', bottom: '16px', left: 0, right: 0, textAlign: 'center', fontSize: '10px', color: 'var(--mist)' }}>
        <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>© 2026 Yitia</a>
      </div>
    </div>
  )
}
