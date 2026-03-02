'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcTableResults, formatPoint } from '@/lib/mahjong/calculator'
import type { Tournament, Player, Table, Result } from '@/types'

interface Props {
  tournament: Tournament
  players: Player[]
  tables: Table[]
}

const SEAT_LABELS = ['東', '南', '西', '北']
const SEAT_COLORS = [
  { bg: '#fef9c3', color: '#a16207' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#dcfce7', color: '#166534' },
  { bg: '#f3e8ff', color: '#6b21a8' },
]

export default function ScheduleClient({ tournament, players, tables }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeRound, setActiveRound] = useState(1)
  const [scores, setScores] = useState<Record<string, { value: string; negative: boolean }>>({})
  const [extraSticks, setExtraSticks] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const rounds = Array.from({ length: tournament.num_rounds }, (_, i) => i + 1)
  const roundTables = tables.filter(t => t.round_number === activeRound)

  useEffect(() => {
    const firstUnvalidated = tables.find(t => !t.is_validated)
    if (firstUnvalidated) setActiveRound(firstUnvalidated.round_number)
  }, [tables])

  function getPlayer(id: string) {
    return players.find(p => p.id === id)
  }

  function getScore(resultId: string) {
    return scores[resultId] ?? { value: '', negative: false }
  }

  function setScore(resultId: string, value: string) {
    setScores(s => ({ ...s, [resultId]: { ...getScore(resultId), value } }))
  }

  function toggleNegative(resultId: string) {
    setScores(s => ({ ...s, [resultId]: { ...getScore(resultId), negative: !getScore(resultId).negative } }))
  }

  async function handleValidate(table: Table) {
    const results = (table as any).results as Result[]
    if (!results) return

    const scored = results.map(r => {
      const sc = getScore(r.id)
      const raw = sc.value !== '' ? parseInt(sc.value) * 100 : r.score
      return { ...r, score: sc.negative ? -raw : raw }
    })

    // 合計チェック: 持ち点×4 が正しい合計（卓外点棒がある場合はスキップ）
    const hasExtraSticks = extraSticks[table.id] ?? false
    if (!hasExtraSticks) {
      const total = scored.reduce((sum, r) => sum + r.score, 0)
      const expected = tournament.config.startingPoints * 4
      const tolerance = 100 // 1本場分の誤差は許容
      if (Math.abs(total - expected) > tolerance) {
        alert(`スコア合計が ${total.toLocaleString()} です。\n正しい合計は ${expected.toLocaleString()} のはずです。\n卓外点棒がある場合はチェックを入れてください。`)
        return
      }
    }

    const calculated = calcTableResults(scored, tournament.config)
    setSaving(table.id)

    for (const r of calculated) {
      await supabase.from('results').update({ score: r.score, point: r.point, rank: r.rank }).eq('id', r.id)
    }
    await supabase.from('tables').update({ is_validated: true, has_extra_sticks: hasExtraSticks }).eq('id', table.id)

    setSaving(null)
    router.refresh()
  }

  async function handleUnvalidate(tableId: string) {
    await supabase.from('tables').update({ is_validated: false }).eq('id', tableId)
    router.refresh()
  }

  const validatedCount = tables.filter(t => t.is_validated).length

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        height: '52px', background: '#fff', borderBottom: '1px solid var(--border)',
        padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{tournament.name} › </span>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>卓組</span>
        </div>
        <span style={{
          display: 'inline-flex', padding: '2px 8px', borderRadius: '5px',
          fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
          background: 'var(--paper)', color: 'var(--slate)', border: '1px solid var(--border)',
        }}>確定 {validatedCount}/{tables.length}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px' }}>
        <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800, marginBottom: '3px' }}>卓組</div>
        <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '18px' }}>
          {tournament.name} — R{activeRound} / {tournament.num_rounds}
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {rounds.map(r => {
            const allDone = tables.filter(t => t.round_number === r).every(t => t.is_validated)
            return (
              <button key={r} onClick={() => setActiveRound(r)} style={{
                padding: '6px 15px', borderRadius: '16px',
                border: `1.5px solid ${activeRound === r ? 'var(--navy)' : 'var(--border-md)'}`,
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
                background: activeRound === r ? 'var(--navy)' : '#fff',
                color: activeRound === r ? '#fff' : allDone ? 'var(--cyan-deep)' : 'var(--mist)',
              }}>R{r}{allDone ? ' ✓' : ''}</button>
            )
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
          {roundTables.map(table => {
            const results: Result[] = (table as any).results ?? []
            const isValidated = table.is_validated
            const hasExtra = extraSticks[table.id] ?? false

            return (
              <div key={table.id} style={{
                background: '#fff',
                border: `1.5px solid ${isValidated ? 'rgba(14,165,233,0.35)' : 'var(--border)'}`,
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 1px 8px rgba(15,21,32,0.07)',
              }}>
                <div style={{
                  padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: isValidated ? 'var(--cyan-deep)' : 'var(--navy)', color: '#fff',
                }}>
                  <span style={{ fontFamily: 'serif', fontSize: '15px', fontWeight: 800 }}>卓 {table.table_number}</span>
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.13)', padding: '2px 8px', borderRadius: '3px' }}>
                    {isValidated ? '✓ 確定済み' : '入力中'}
                  </span>
                </div>
                <div style={{ padding: '10px 13px' }}>
                  {results.sort((a, b) => a.seat_index - b.seat_index).map(result => {
                    const player = getPlayer(result.player_id) ?? (result as any).player
                    const sc = getScore(result.id)
                    const seatColor = SEAT_COLORS[result.seat_index]
                    return (
                      <div key={result.id} style={{
                        display: 'flex', alignItems: 'center', gap: '7px',
                        padding: '6px 0', borderBottom: '1px solid var(--paper)',
                      }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700, flexShrink: 0, fontFamily: 'serif',
                          background: seatColor.bg, color: seatColor.color,
                        }}>{SEAT_LABELS[result.seat_index]}</div>
                        <div style={{ flex: 1, fontSize: '12.5px', fontWeight: 600 }}>
                          {player?.seat_order != null ? `${player.seat_order + 1}. ` : ''}{player?.name ?? '?'}
                        </div>
                        {isValidated ? (
                          <div style={{ textAlign: 'right', minWidth: '68px' }}>
                            <div style={{ fontSize: '9px', color: 'var(--mist)', fontFamily: 'monospace' }}>{result.rank}位</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: result.point >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                              {formatPoint(result.point)}
                            </div>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => toggleNegative(result.id)} style={{
                              width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                              border: `1.5px solid ${sc.negative ? 'rgba(239,68,68,0.3)' : 'var(--border-md)'}`,
                              background: sc.negative ? 'var(--red-pale)' : 'var(--paper)',
                              color: sc.negative ? 'var(--red)' : 'var(--mist)',
                              fontSize: '9px', fontWeight: 700, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>▲</button>
                            <input
                              type="number"
                              value={sc.value}
                              onChange={e => setScore(result.id, e.target.value)}
                              placeholder="0"
                              style={{
                                width: '72px', padding: '4px 7px',
                                background: 'var(--paper)', border: '1.5px solid var(--border-md)',
                                borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                                textAlign: 'right', fontFamily: 'monospace', outline: 'none',
                              }}
                            />
                            <span style={{ fontSize: '9.5px', color: 'var(--mist)', fontFamily: 'monospace', flexShrink: 0 }}>00</span>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: '7px 13px 11px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {isValidated ? (
                    <button onClick={() => handleUnvalidate(table.id)} style={{
                      width: '100%', padding: '6px', background: 'transparent',
                      border: '1.5px solid var(--border-md)', borderRadius: '7px',
                      fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', color: 'var(--slate)',
                    }}>スコア修正</button>
                  ) : (
                    <>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '11px', color: 'var(--mist)', cursor: 'pointer',
                        padding: '3px 4px', borderRadius: '5px',
                      }}>
                        <input
                          type="checkbox"
                          checked={hasExtra}
                          onChange={e => setExtraSticks(s => ({ ...s, [table.id]: e.target.checked }))}
                          style={{ width: '13px', height: '13px', accentColor: 'var(--cyan-deep)' }}
                        />
                        卓外点棒あり（合計チェックをスキップ）
                      </label>
                      <button onClick={() => handleValidate(table)} disabled={saving === table.id} style={{
                        width: '100%', padding: '8px',
                        background: saving === table.id ? 'var(--mist)' : 'var(--cyan-deep)',
                        border: 'none', borderRadius: '7px',
                        fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', color: '#fff',
                      }}>{saving === table.id ? '確定中...' : 'スコア確定'}</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
