import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--mist)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚙️</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>準備中</div>
          <div style={{ fontSize: '13px', marginTop: '6px' }}>この機能は近日公開予定です</div>
        </div>
      </div>
    </div>
  )
}
