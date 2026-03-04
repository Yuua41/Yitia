'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcTableResults } from '@/lib/mahjong/calculator'
import type { Tournament, RuleConfig, Result } from '@/types'
import { nanoid } from 'nanoid'

interface Props {
  tournaments: Tournament[]
}

const DEFAULT_CONFIG: RuleConfig = {
  startingPoints: 25000,
  returnPoints: 30000,
  uma: [30, 10, -10, -30],
  tieBreak: 'split',
  seatMode: 'random',
  umaMode: 'simple',
  rounding: 'none',
}

export default function DashboardClient({ tournaments }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [heldOn, setHeldOn] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [playerText, setPlayerText] = useState('')
  const [numRounds, setNumRounds] = useState(4)

  async function handleCreate() {
    if (!name.trim()) return alert('大会名を入力してください')
    const names = playerText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean)
    if (names.length < 4) return alert('プレイヤーを4名以上入力してください')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        held_on: heldOn || null,
        notes: notes || null,
        num_rounds: numRounds,
        config: DEFAULT_CONFIG,
        admin_token: nanoid(12),
        status: 'draft',
      })
      .select()
      .single()

    if (error || !tournament) {
      alert('作成に失敗しました: ' + error?.message)
      setSaving(false)
      return
    }

    let adjustedNames = [...names]
    while (adjustedNames.length % 4 !== 0) {
      adjustedNames.push(`黒子${4 - (adjustedNames.length % 4)}`)
    }

    const playersToInsert = adjustedNames.map((n, idx) => ({
      tournament_id: tournament.id,
      name: n,
      seat_order: idx,
      token: nanoid(12),
      bonus: 0,
    }))

    const { data: players, error: pErr } = await supabase
      .from('players')
      .insert(playersToInsert)
      .select()

    if (pErr || !players) {
      alert('プレイヤー作成失敗: ' + pErr?.message)
      setSaving(false)
      return
    }

    const { generateSchedule } = await import('@/lib/mahjong/calculator')
    const playerIds = players.map(p => p.id)
    const schedule = generateSchedule(playerIds, numRounds)

    for (const round of schedule) {
      for (const tbl of round.tables) {
        const { data: tableRow, error: tErr } = await supabase
          .from('tables')
          .insert({
            tournament_id: tournament.id,
            round_number: round.roundNumber,
            table_number: round.tables.indexOf(tbl) + 1,
            has_extra_sticks: false,
            is_validated: false,
          })
          .select()
          .single()

        if (tErr || !tableRow) continue

        const resultsToInsert = tbl.seatOrder.map((pid, seatIdx) => ({
          table_id: tableRow.id,
          player_id: pid,
          seat_index: seatIdx,
          score: 0,
          point: 0,
          rank: 0,
          is_negative_mode: false,
        }))

        await supabase.from('results').insert(resultsToInsert)
      }
    }

    router.push(`/tournament/${tournament.id}/settings`)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const { data: tables } = await supabase
      .from('tables')
      .select('id')
      .eq('tournament_id', deleteTarget.id)

    if (tables && tables.length > 0) {
      const tableIds = tables.map(t => t.id)
      await supabase.from('results').delete().in('table_id', tableIds)
    }

    await supabase.from('tables').delete().eq('tournament_id', deleteTarget.id)
    await supabase.from('players').delete().eq('tournament_id', deleteTarget.id)
    await supabase.from('tournaments').delete().eq('id', deleteTarget.id)

    setDeleting(false)
    setDeleteTarget(null)
    router.refresh()
  }

  async function handleCreateSample() {
    setSeeding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSeeding(false); return }

    const sampleConfig: RuleConfig = {
      startingPoints: 25000,
      returnPoints: 30000,
      uma: [30, 10, -10, -30],
      tieBreak: 'split',
      seatMode: 'random',
      umaMode: 'simple',
      rounding: 'none',
    }

    // --- 完了済み大会 ---
    const { data: t1, error: e1 } = await supabase
      .from('tournaments')
      .insert({
        owner_id: user.id,
        name: '第42回 春季麻雀大会',
        held_on: '2026-03-01',
        notes: 'サンプルデータ。25000点持ち30000点返し、ウマ30-10。',
        num_rounds: 4,
        config: sampleConfig,
        admin_token: nanoid(12),
        status: 'finished',
      })
      .select()
      .single()

    if (e1 || !t1) {
      alert('作成失敗: ' + e1?.message)
      setSeeding(false)
      return
    }

    const names8 = ['佐藤', '田中', '鈴木', '山田', '渡辺', '高橋', '伊藤', '中村']
    const { data: p1 } = await supabase
      .from('players')
      .insert(names8.map((n, i) => ({
        tournament_id: t1.id, name: n, seat_order: i, token: nanoid(12),
        bonus: i === 2 ? -20 : 0, // 鈴木にチョンボ -20
      })))
      .select()

    if (!p1) { setSeeding(false); return }

    // 卓割り + スコア (各卓の合計 = 100000)
    const rounds1: { r: number; t: number; pi: number[]; sc: number[] }[] = [
      { r: 1, t: 1, pi: [0,1,2,3], sc: [35000,28000,22000,15000] },
      { r: 1, t: 2, pi: [4,5,6,7], sc: [42000,25000,18000,15000] },
      { r: 2, t: 1, pi: [0,4,1,5], sc: [30000,30000,25000,15000] },
      { r: 2, t: 2, pi: [2,6,3,7], sc: [38000,32000,20000,10000] },
      { r: 3, t: 1, pi: [0,6,3,5], sc: [45000,22000,18000,15000] },
      { r: 3, t: 2, pi: [1,7,2,4], sc: [33000,27000,23000,17000] },
      { r: 4, t: 1, pi: [0,7,2,5], sc: [28000,28000,28000,16000] },
      { r: 4, t: 2, pi: [1,6,3,4], sc: [40000,30000,20000,10000] },
    ]

    for (const rd of rounds1) {
      const { data: tbl } = await supabase
        .from('tables')
        .insert({ tournament_id: t1.id, round_number: rd.r, table_number: rd.t, has_extra_sticks: false, is_validated: true })
        .select().single()
      if (!tbl) continue

      const initResults = rd.pi.map((pIdx, seat) => ({
        table_id: tbl.id, player_id: p1[pIdx].id, seat_index: seat,
        score: rd.sc[seat], point: 0, rank: 0, is_negative_mode: false,
      }))
      const { data: rows } = await supabase.from('results').insert(initResults).select()
      if (!rows) continue

      const calc = calcTableResults(rows as Result[], sampleConfig)
      for (const c of calc) {
        await supabase.from('results').update({ point: c.point, rank: c.rank }).eq('id', c.id)
      }
    }

    // --- 進行中大会 ---
    const { data: t2 } = await supabase
      .from('tournaments')
      .insert({
        owner_id: user.id,
        name: '月例大会 3月',
        held_on: '2026-03-15',
        notes: null,
        num_rounds: 3,
        config: sampleConfig,
        admin_token: nanoid(12),
        status: 'ongoing',
      })
      .select().single()

    if (t2) {
      const { data: p2 } = await supabase
        .from('players')
        .insert(names8.map((n, i) => ({
          tournament_id: t2.id, name: n, seat_order: i, token: nanoid(12), bonus: 0,
        })))
        .select()

      if (p2) {
        const rounds2: { r: number; t: number; pi: number[]; sc: number[]; validated: boolean }[] = [
          { r: 1, t: 1, pi: [0,1,2,3], sc: [32000,29000,24000,15000], validated: true },
          { r: 1, t: 2, pi: [4,5,6,7], sc: [36000,28000,21000,15000], validated: true },
          { r: 2, t: 1, pi: [0,5,2,7], sc: [40000,25000,20000,15000], validated: true },
          { r: 2, t: 2, pi: [1,4,3,6], sc: [30000,30000,25000,15000], validated: true },
          { r: 3, t: 1, pi: [0,6,1,7], sc: [25000,25000,25000,25000], validated: false },
          { r: 3, t: 2, pi: [2,4,3,5], sc: [25000,25000,25000,25000], validated: false },
        ]

        for (const rd of rounds2) {
          const { data: tbl } = await supabase
            .from('tables')
            .insert({ tournament_id: t2.id, round_number: rd.r, table_number: rd.t, has_extra_sticks: false, is_validated: rd.validated })
            .select().single()
          if (!tbl) continue

          if (rd.validated) {
            const initResults = rd.pi.map((pIdx, seat) => ({
              table_id: tbl.id, player_id: p2[pIdx].id, seat_index: seat,
              score: rd.sc[seat], point: 0, rank: 0, is_negative_mode: false,
            }))
            const { data: rows } = await supabase.from('results').insert(initResults).select()
            if (!rows) continue
            const calc = calcTableResults(rows as Result[], sampleConfig)
            for (const c of calc) {
              await supabase.from('results').update({ point: c.point, rank: c.rank }).eq('id', c.id)
            }
          } else {
            // 未入力のラウンド
            const initResults = rd.pi.map((pIdx, seat) => ({
              table_id: tbl.id, player_id: p2[pIdx].id, seat_index: seat,
              score: 0, point: 0, rank: 0, is_negative_mode: false,
            }))
            await supabase.from('results').insert(initResults)
          }
        }
      }
    }

    setSeeding(false)
    router.refresh()
  }

  const statusLabel = (t: Tournament) => {
    if (t.status === 'ongoing') return { text: '進行中', color: 'var(--cyan-deep)', bg: 'var(--cyan-pale)' }
    if (t.status === 'finished') return { text: '完了', color: '#15803d', bg: '#f0fdf4' }
    return { text: '下書き', color: 'var(--mist)', bg: 'var(--paper)' }
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media (max-width: 768px) {
          .dash-header { padding: 0 16px !important; }
          .dash-content { padding: 16px !important; }
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="dash-header" style={{
        height: '52px', background: '#fff', borderBottom: '1px solid var(--border)',
        padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'serif', fontSize: '16px', fontWeight: 700, letterSpacing: '0.04em' }}>大会一覧</span>
      </div>

      <div className="dash-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 26px' }}>
        <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800, marginBottom: '3px' }}>大会一覧</div>
        <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleCreateSample}
            disabled={seeding}
            style={{
              padding: '3px 10px', background: 'transparent',
              border: '1px solid var(--border-md)', borderRadius: '6px',
              fontSize: '11px', color: 'var(--gold-dark)', cursor: 'pointer',
              fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >{seeding ? '作成中...' : 'サンプルデータを作成'}</button>
        </div>

        <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
          {tournaments.map(t => {
            const s = statusLabel(t)
            return (
              <div key={t.id} style={{
                background: '#fff', border: '1.5px solid var(--border)',
                borderRadius: '12px', padding: '18px', cursor: navigatingId ? 'wait' : 'pointer',
                transition: 'all 0.15s', boxShadow: '0 1px 8px rgba(15,21,32,0.07)',
                position: 'relative', overflow: 'hidden',
                opacity: navigatingId && navigatingId !== t.id ? 0.5 : 1,
              }}
                onMouseEnter={e => !navigatingId && (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: t.status === 'ongoing'
                    ? 'linear-gradient(90deg, #abdad1, #8ecbc2)'
                    : t.status === 'finished' ? '#f4a460' : 'var(--border-md)',
                }} />

                <button
                  onClick={e => { e.stopPropagation(); setDeleteTarget(t) }}
                  style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'transparent', border: '1px solid var(--border-md)',
                    color: 'var(--mist)', fontSize: '11px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.13s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-pale)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--mist)'; e.currentTarget.style.borderColor = 'var(--border-md)' }}
                >✕</button>

                <div
                  onClick={() => { setNavigatingId(t.id); router.push(`/tournament/${t.id}/schedule`) }}
                  style={{ paddingRight: '24px' }}
                >
                  <div style={{ fontFamily: 'serif', fontSize: '16px', fontWeight: 700, marginBottom: '5px' }}>
                    {navigatingId === t.id ? <span style={{ fontSize: '12px', color: 'var(--mist)', fontWeight: 600 }}>Loading...</span> : t.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'monospace', marginBottom: '8px' }}>
                    {t.held_on ?? '日程未定'} &nbsp;|&nbsp; {t.num_rounds}回戦 &nbsp;|&nbsp; {t.players?.length ?? 0}名
                  </div>
                  {t.notes && (
                    <div style={{
                      fontSize: '11.5px', color: 'var(--slate)',
                      background: 'var(--paper)', borderRadius: '7px',
                      padding: '7px 9px', border: '1px solid var(--border)',
                      lineHeight: 1.5, marginBottom: '10px',
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    } as React.CSSProperties}>{t.notes}</div>
                  )}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{
                      display: 'inline-flex', padding: '2px 8px', borderRadius: '5px',
                      fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
                      background: s.bg, color: s.color,
                    }}>{s.text}</span>
                  </div>
                </div>
              </div>
            )
          })}

          <div
            onClick={() => setShowForm(true)}
            style={{
              background: 'transparent', border: '1.5px dashed var(--border-md)',
              borderRadius: '12px', padding: '18px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: '148px', gap: '8px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--gold-pale)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ width: '40px', height: '40px', background: 'var(--gold-pale)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'var(--gold-dark)' }}>＋</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold-dark)' }}>新しい大会を作成</div>
          </div>
        </div>
      </div>

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,21,32,0.5)',
          backdropFilter: 'blur(4px)', zIndex: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '380px',
            boxShadow: '0 20px 60px rgba(15,21,32,0.2)',
          }}>
            <div style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--red)' }}>削除</div>
            <div style={{ fontFamily: 'serif', fontSize: '17px', fontWeight: 800, marginBottom: '8px' }}>大会を削除しますか？</div>
            <div style={{
              fontSize: '13px', color: 'var(--slate)', marginBottom: '6px',
              background: 'var(--paper)', padding: '10px 13px', borderRadius: '8px',
              fontWeight: 600,
            }}>「{deleteTarget.name}」</div>
            <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '22px' }}>
              この操作は取り消せません。卓組・スコア・成績がすべて削除されます。
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={btnOutline}
              >キャンセル</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: '8px 18px', background: deleting ? 'var(--mist)' : 'var(--red)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >{deleting ? '削除中...' : '削除する'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 大会作成モーダル */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,21,32,0.5)',
          backdropFilter: 'blur(4px)', zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: 'clamp(20px, 4vw, 28px)',
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(15,21,32,0.2)',
          }}>
            <div style={{ fontFamily: 'serif', fontSize: '18px', fontWeight: 800, marginBottom: '20px' }}>新しい大会を作成</div>

            <div style={{ marginBottom: '13px' }}>
              <label style={labelStyle}>大会名 *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="例：第1回 春季大会" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '13px' }}>
              <div>
                <label style={labelStyle}>開催日</label>
                <input type="date" value={heldOn} onChange={e => setHeldOn(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>試合数</label>
                <select value={numRounds} onChange={e => setNumRounds(+e.target.value)} style={inputStyle}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}回戦</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '13px' }}>
              <label style={labelStyle}>プレイヤー名（改行またはカンマ区切り）</label>
              <textarea value={playerText} onChange={e => setPlayerText(e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', lineHeight: 1.65 }} placeholder="アカギ&#10;カイジ&#10;衣..." />
              <div style={{ fontSize: '11px', color: 'var(--mist)', marginTop: '3px' }}>
                {playerText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length} 名入力中
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>備考</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', lineHeight: 1.65 }} placeholder="ルールの補足、チョンボ罰則など..." />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={btnOutline}>キャンセル</button>
              <button onClick={handleCreate} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                {saving ? '作成中...' : '大会を作成する →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--mist)', marginBottom: '5px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'var(--paper)', border: '1.5px solid var(--border-md)',
  borderRadius: '9px', fontSize: '13px', color: 'var(--ink)', outline: 'none',
  fontFamily: 'inherit',
}
const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'linear-gradient(135deg, #f4a460, #d88a45)', color: '#fff',
  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
}
const btnOutline: React.CSSProperties = {
  padding: '8px 18px', background: 'transparent',
  border: '1.5px solid var(--border-md)', color: 'var(--slate)',
  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
}
