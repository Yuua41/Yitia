'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  email: string
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'var(--surface)', border: '1px solid var(--border-md)',
  borderRadius: '12px', fontSize: '14px', color: 'var(--ink)', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--slate)', marginBottom: '6px',
}

const btnStyle = (loading: boolean): React.CSSProperties => ({
  padding: '10px 20px',
  background: loading ? 'var(--mist)' : 'linear-gradient(135deg, var(--cyan-deep), var(--cyan) 180%)',
  boxShadow: loading ? 'none' : '0 2px 12px var(--focus-shadow)',
  color: '#fff', border: 'none', borderRadius: '12px',
  fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
  letterSpacing: '0.01em',
})

export default function ProfileClient({ email }: Props) {
  const supabase = createClient()

  // Email
  const [newEmail, setNewEmail] = useState(email)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    if (newEmail === email) return
    setEmailLoading(true)
    setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      setEmailMsg({ text: 'メールアドレスの変更に失敗しました: ' + error.message, type: 'error' })
    } else {
      setEmailMsg({ text: '確認メールを送信しました。新しいメールアドレスのリンクをクリックして変更を完了してください。', type: 'success' })
    }
    setEmailLoading(false)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPwMsg({ text: 'パスワードは8文字以上で、英大文字・英小文字・数字をそれぞれ含めてください', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'パスワードが一致しません', type: 'error' })
      return
    }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwMsg({ text: 'パスワードの変更に失敗しました: ' + error.message, type: 'error' })
    } else {
      setPwMsg({ text: 'パスワードを変更しました', type: 'success' })
      setNewPassword('')
      setConfirmPassword('')
    }
    setPwLoading(false)
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
        <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' }}>プロフィール</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 26px' }}>
        <div style={{ maxWidth: '480px' }}>

          {/* Email Section */}
          <form onSubmit={handleEmailChange}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--ink)' }}>メールアドレス</h2>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>メールアドレス</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            {emailMsg && (
              <div style={{
                fontSize: '12px',
                color: emailMsg.type === 'error' ? 'var(--red)' : 'var(--cyan-deep)',
                background: emailMsg.type === 'error' ? 'var(--red-pale)' : 'var(--cyan-pale)',
                padding: '8px 12px', borderRadius: '7px', marginBottom: '14px',
              }}>
                {emailMsg.text}
              </div>
            )}
            <button type="submit" disabled={emailLoading || newEmail === email} style={btnStyle(emailLoading || newEmail === email)}>
              {emailLoading ? '送信中...' : '変更する'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '32px 0' }} />

          {/* Password Section */}
          <form onSubmit={handlePasswordChange}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--ink)' }}>パスワード変更</h2>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>新しいパスワード</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                placeholder="8文字以上（英大文字・英小文字・数字を含む）"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>新しいパスワード（確認）</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            {pwMsg && (
              <div style={{
                fontSize: '12px',
                color: pwMsg.type === 'error' ? 'var(--red)' : 'var(--cyan-deep)',
                background: pwMsg.type === 'error' ? 'var(--red-pale)' : 'var(--cyan-pale)',
                padding: '8px 12px', borderRadius: '7px', marginBottom: '14px',
              }}>
                {pwMsg.text}
              </div>
            )}
            <button type="submit" disabled={pwLoading || !newPassword || !confirmPassword} style={btnStyle(pwLoading || !newPassword || !confirmPassword)}>
              {pwLoading ? '変更中...' : '変更する'}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
