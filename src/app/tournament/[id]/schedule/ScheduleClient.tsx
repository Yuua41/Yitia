'use client'

import { useState, useEffect, useCallback } from 'react'
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
const NUM_COLOR = { bg: 'var(--paper)', color: 'var(--slate)' }

export default function ScheduleClient({ tournament, players, tables }: Props) {
  const supabase = createClient()
  const [localTables, setLocalTables] = useState(tables)
  const [activeRound, setActiveRound] = useState(1)
  const [extraSticks, setExtraSticks] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [dragInfo, setDragInfo] = useState<{ resultId: string; playerId: string } | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  // Initialize scores from submitted tables
  const initScores = () => {
    const s: Record<string, { value: string; negative: boolean }> = {}
    tables.forEach(t => {
      if (t.is_submitted && !t.is_validated) {
        const results = (t as any).results as Result[]
        results?.forEach(r => {
          if (r.score !== 0) {
            s[r.id] = { value: (Math.abs(r.score) / 100).toString(), negative: r.score < 0 }
          }
        })
      }
    })
    return s
  }
  const [scores, setScores] = useState<Record<string, { value: string; negative: boolean }>>(initScores)

  const isDraft = tournament.status === 'draft'
  const canSwap = tournament.status !== 'finished'
  const noSeat = tournament.config.seatMode === 'none'
  const rounds = Array.from({ length: tournament.num_rounds }, (_, i) => i + 1)
  const roundTables = localTables.filter(t => t.round_number === activeRound)

  // Refetch data from Supabase (client-side, no SSR roundtrip)
  const refetchData = useCallback(async () => {
    const { data } = await supabase
      .from('tables')
      .select('*, results(*, player:players(*))')
      .eq('tournament_id', tournament.id)
      .order('round_number')
      .order('table_number')
    if (data) {
      setLocalTables(data)
      // Pre-populate scores for newly submitted tables
      const newScores: Record<string, { value: string; negative: boolean }> = {}
      data.forEach(t => {
        if (t.is_submitted && !t.is_validated) {
          const results = (t as any).results as Result[]
          results?.forEach(r => {
            if (r.score !== 0) {
              newScores[r.id] = { value: (Math.abs(r.score) / 100).toString(), negative: r.score < 0 }
            }
          })
        }
      })
      setScores(prev => {
        const merged = { ...prev }
        for (const [id, val] of Object.entries(newScores)) {
          if (!merged[id]) merged[id] = val
        }
        return merged
      })
    }
  }, [supabase, tournament.id])

  // Refetch on window focus for cross-client sync
  useEffect(() => {
    const handler = () => { refetchData() }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [refetchData])

  useEffect(() => {
    const firstUnvalidated = localTables.find(t => !t.is_validated)
    if (firstUnvalidated) setActiveRound(firstUnvalidated.round_number)
  }, []) // Only on mount

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

    const hasExtraSticks = extraSticks[table.id] ?? false
    if (!hasExtraSticks) {
      const total = scored.reduce((sum, r) => sum + r.score, 0)
      const expected = tournament.config.startingPoints * 4
      const tolerance = 100
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
    await supabase.from('tables').update({ is_validated: true, is_submitted: true, has_extra_sticks: hasExtraSticks }).eq('id', table.id)

    // Update local state
    setLocalTables(prev => prev.map(t => {
      if (t.id !== table.id) return t
      const origResults = (t as any).results as Result[]
      return {
        ...t,
        is_validated: true,
        is_submitted: true,
        has_extra_sticks: hasExtraSticks,
        results: calculated.map(c => {
          const orig = origResults?.find(r => r.id === c.id)
          return { ...orig, ...c }
        }),
      }
    }))
    setSaving(null)
  }

  async function handleUnvalidate(tableId: string) {
    const table = localTables.find(t => t.id === tableId)
    if (table) {
      const results = (table as any).results as Result[]
      if (results) {
        const newScores = { ...scores }
        results.forEach(r => {
          const absScore = Math.abs(r.score)
          newScores[r.id] = {
            value: (absScore / 100).toString(),
            negative: r.score < 0,
          }
        })
        setScores(newScores)
      }
      setExtraSticks(s => ({ ...s, [tableId]: table.has_extra_sticks }))
    }
    await supabase.from('tables').update({ is_validated: false }).eq('id', tableId)

    setLocalTables(prev => prev.map(t =>
      t.id === tableId ? { ...t, is_validated: false } : t
    ))
  }

  async function handleSwapPlayer(resultId: string, newPlayerId: string) {
    const allRoundResults = roundTables.flatMap(t => ((t as any).results ?? []) as Result[])
    const currentResult = allRoundResults.find(r => r.id === resultId)
    const targetResult = allRoundResults.find(r => r.player_id === newPlayerId && r.id !== resultId)
    if (!currentResult || !targetResult) return

    setSwapping(true)
    const oldPlayerId = currentResult.player_id
    await supabase.from('results').update({ player_id: newPlayerId }).eq('id', currentResult.id)
    await supabase.from('results').update({ player_id: oldPlayerId }).eq('id', targetResult.id)

    // Update local state
    setLocalTables(prev => prev.map(t => {
      const results = (t as any).results as Result[]
      if (!results?.some(r => r.id === currentResult.id || r.id === targetResult.id)) return t
      return {
        ...t,
        results: results.map(r => {
          if (r.id === currentResult.id) return { ...r, player_id: newPlayerId }
          if (r.id === targetResult.id) return { ...r, player_id: oldPlayerId }
          return r
        }),
      }
    }))
    setSwapping(false)
  }

  function sortResults(results: Result[]) {
    return [...results].sort((a, b) => a.seat_index - b.seat_index)
  }

  const validatedCount = localTables.filter(t => t.is_validated).length

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .schedule-header { padding: 0 26px; }
        .schedule-content { padding: 24px 26px; }
        @media (max-width: 768px) {
          .schedule-header { padding: 0 16px !important; }
          .schedule-content { padding: 16px !important; }
        }
      `}</style>
      <div className="schedule-header" style={{
        height: '52px', background: '#fff', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{tournament.name} › </span>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>卓組・成績入力</span>
        </div>
        <span style={{
          display: 'inline-flex', padding: '2px 8px', borderRadius: '5px',
          fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
          background: 'var(--paper)', color: 'var(--slate)', border: '1px solid var(--border)',
        }}>確定 {validatedCount}/{localTables.length}</span>
      </div>
      <div className="schedule-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800, marginBottom: '3px' }}>卓組・成績入力</div>
        <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '18px' }}>
          {tournament.name} — R{activeRound} / {tournament.num_rounds}
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {rounds.map(r => {
            const allDone = localTables.filter(t => t.round_number === r).every(t => t.is_validated)
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
            const isSubmitted = table.is_submitted
            const hasExtra = extraSticks[table.id] ?? false

            const statusLabel = isValidated ? '✓ 確定済み' : isSubmitted ? '確定待ち' : '入力中'
            const statusBg = isValidated ? 'var(--cyan-deep)' : isSubmitted ? '#d97706' : 'var(--navy)'

            return (
              <div key={table.id} style={{
                background: '#fff',
                border: `1.5px solid ${isValidated ? 'rgba(14,165,233,0.35)' : isSubmitted ? 'rgba(217,119,6,0.35)' : 'var(--border)'}`,
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 1px 8px rgba(15,21,32,0.07)',
              }}>
                <div style={{
                  padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: statusBg, color: '#fff',
                }}>
                  <span style={{ fontFamily: 'serif', fontSize: '15px', fontWeight: 800 }}>卓 {table.table_number}</span>
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.13)', padding: '2px 8px', borderRadius: '3px' }}>
                    {statusLabel}
                  </span>
                </div>
                <div style={{ padding: '10px 13px' }}>
                  {sortResults(results).map(result => {
                    const player = getPlayer(result.player_id) ?? (result as any).player
                    const sc = getScore(result.id)
                    const seatColor = noSeat ? NUM_COLOR : SEAT_COLORS[result.seat_index]
                    const seatLabel = noSeat ? `${result.seat_index + 1}` : SEAT_LABELS[result.seat_index]
                    return (
                      <div key={result.id} style={{
                        display: 'flex', alignItems: 'center', gap: '7px',
                        padding: '6px 0', borderBottom: '1px solid var(--paper)',
                      }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: noSeat ? '4px' : '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: noSeat ? '11px' : '10px', fontWeight: 700, flexShrink: 0,
                          fontFamily: noSeat ? 'monospace' : 'serif',
                          background: seatColor.bg, color: seatColor.color,
                        }}>{seatLabel}</div>
                        {canSwap && !isValidated ? (
                          <div
                            draggable
                            onDragStart={(e) => {
                              setDragInfo({ resultId: result.id, playerId: result.player_id })
                              e.dataTransfer.effectAllowed = 'move'
                              e.dataTransfer.setData('text/plain', result.id)
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                              if (dragInfo && dragInfo.resultId !== result.id) {
                                setDropTargetId(result.id)
                              }
                            }}
                            onDragLeave={() => setDropTargetId(null)}
                            onDrop={(e) => {
                              e.preventDefault()
                              if (dragInfo && dragInfo.resultId !== result.id) {
                                handleSwapPlayer(dragInfo.resultId, result.player_id)
                              }
                              setDragInfo(null)
                              setDropTargetId(null)
                            }}
                            onDragEnd={() => {
                              setDragInfo(null)
                              setDropTargetId(null)
                            }}
                            style={{
                              flex: 1, fontSize: '12.5px', fontWeight: 600,
                              padding: '4px 8px', borderRadius: '6px', cursor: 'grab',
                              background: dropTargetId === result.id ? 'var(--cyan-pale)' : 'var(--paper)',
                              border: `1.5px dashed ${dropTargetId === result.id ? 'var(--cyan-deep)' : 'var(--border-md)'}`,
                              opacity: dragInfo?.resultId === result.id ? 0.5 : 1,
                              transition: 'background 0.1s, border-color 0.1s',
                              userSelect: 'none',
                            }}
                          >
                            {player?.seat_order != null ? `${player.seat_order + 1}. ` : ''}{player?.name ?? '?'}
                          </div>
                        ) : (
                          <div style={{ flex: 1, fontSize: '12.5px', fontWeight: 600 }}>
                            {player?.seat_order != null ? `${player.seat_order + 1}. ` : ''}{player?.name ?? '?'}
                          </div>
                        )}
                        {isValidated ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '9px', color: 'var(--mist)', fontFamily: 'monospace' }}>{(result.score / 100).toLocaleString()}00</span>
                            <div style={{ textAlign: 'right', minWidth: '68px' }}>
                              <div style={{ fontSize: '9px', color: 'var(--mist)', fontFamily: 'monospace' }}>{Math.floor(result.rank)}位</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: result.point >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                                {formatPoint(result.point)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => toggleNegative(result.id)} style={{
                              width: '34px', height: '34px', borderRadius: '6px', flexShrink: 0,
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
                              placeholder={(tournament.config.startingPoints / 100).toString()}
                              style={{
                                width: '80px', padding: '6px 7px',
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
                    <>
                      {table.has_extra_sticks && (
                        <div style={{ fontSize: '10.5px', color: 'var(--mist)', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: 'var(--cyan-deep)' }}>✓</span> 卓外点棒あり
                        </div>
                      )}
                      <button onClick={() => handleUnvalidate(table.id)} style={{
                        width: '100%', padding: '6px', background: 'transparent',
                        border: '1.5px solid var(--border-md)', borderRadius: '7px',
                        fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', color: 'var(--slate)',
                      }}>スコア修正</button>
                    </>
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
