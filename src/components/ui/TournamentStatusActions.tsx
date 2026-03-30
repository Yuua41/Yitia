'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tournament } from '@/types'

interface Props {
  tournament: Tournament
}

export default function TournamentStatusActions({ tournament }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [allValidated, setAllValidated] = useState(false)

  useEffect(() => {
    if (tournament.status !== 'ongoing') return
    let cancelled = false

    async function check() {
      const { data: tables } = await supabase
        .from('tables')
        .select('id, is_validated')
        .eq('tournament_id', tournament.id)

      if (cancelled || !tables || tables.length === 0) return
      setAllValidated(tables.every(t => t.is_validated))
    }

    check()

    // Listen for table validation changes
    const handler = () => check()
    window.addEventListener('tables-updated', handler)
    // Also poll periodically in case events are missed
    const interval = setInterval(check, 10000)

    return () => {
      cancelled = true
      window.removeEventListener('tables-updated', handler)
      clearInterval(interval)
    }
  }, [tournament.status, tournament.id, supabase])

  async function handleStart() {
    const ok = confirm('大会を開始しますか？開始後はルール設定の変更ができなくなります。')
    if (!ok) return
    setLoading(true)

    const { error } = await supabase
      .from('tournaments')
      .update({ status: 'ongoing' })
      .eq('id', tournament.id)

    if (error) {
      alert('開始に失敗しました: ' + error.message)
      setLoading(false)
      return
    }

    router.refresh()
  }

  async function handleFinish() {
    const ok = confirm('大会を終了しますか？この操作は元に戻せません。')
    if (!ok) return
    setLoading(true)

    const { error } = await supabase
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', tournament.id)

    if (error) {
      alert('終了に失敗しました: ' + error.message)
      setLoading(false)
      return
    }

    router.refresh()
  }

  if (tournament.status === 'draft') {
    return (
      <button onClick={handleStart} disabled={loading} style={{
        padding: '2px 10px', background: 'transparent', color: 'var(--gold)',
        border: '1px solid var(--gold)', borderRadius: '100px',
        fontSize: '9px', fontWeight: 700, cursor: 'pointer',
        opacity: loading ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: '4px',
      }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        {loading ? '開始中...' : '大会を開始'}
      </button>
    )
  }

  if (tournament.status === 'ongoing' && allValidated) {
    return (
      <button onClick={handleFinish} disabled={loading} style={{
        padding: '2px 10px', background: 'transparent', color: 'var(--gold)',
        border: '1px solid var(--gold)', borderRadius: '100px',
        fontSize: '9px', fontWeight: 700, cursor: 'pointer',
        opacity: loading ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: '4px',
      }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        {loading ? '終了中...' : '大会を終了'}
      </button>
    )
  }

  return null
}
