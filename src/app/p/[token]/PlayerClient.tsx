'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatPoint } from '@/lib/mahjong/calculator'
import type { Tournament, Player, Table, Result } from '@/types'

interface Props {
  player: Player
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

export default function PlayerClient({ player, tournament, players, tables }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [scores, setScores] = useState<Record<string, { value: string; negative: boolean }>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [adjustmentInput, setAdjustmentInput] = useState(Math.abs(player.bonus ?? 0).toString())
  const [adjustmentNeg, setAdjustmentNeg] = useState((player.bonus ?? 0) < 0)
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const [swapSource, setSwapSource] = useState<{ resultId: string; playerId: string } | null>(null)
  const [swapping, setSwapping] = useState(false)

  const noSeat = tournament.config.seatMode === 'none'

  function sortResults(results: Result[]) {
    return [...results].sort((a, b) => a.seat_index - b.seat_index)
  }

  async function handleSwapInTable(sourceResultId: string, targetPlayerId: string) {
    const table = tables.find(t => (t as any).results?.some((r: Result) => r.id === sourceResultId))
    if (!table) return
    const results = (table as any).results as Result[]
    const sourceResult = results.find(r => r.id === sourceResultId)
    const targetResult = results.find(r => r.player_id === targetPlayerId)
    if (!sourceResult || !targetResult) return

    setSwapping(true)
    const oldPlayerId = sourceResult.player_id
    await supabase.from('results').update({ player_id: targetPlayerId }).eq('id', sourceResult.id)
    await supabase.from('results').update({ player_id: oldPlayerId }).eq('id', targetResult.id)
    setSwapping(false)
    setSwapSource(null)
    router.refresh()
  }

  function getMyTable(roundNum: number) {
    return tables.find(t =>
      t.round_number === roundNum &&
      (t as any).results?.some((r: Result) => r.player_id === player.id)
    )
  }

  const standings = players.map(p => {
    const roundPoints: (number | null)[] = []
    for (let r = 1; r <= tournament.num_rounds; r++) {
      const table = tables.find(t =>
        t.round_number === r &&
        t.is_validated &&
        (t as any).results?.some((res: Result) => res.player_id === p.id)
      )
      if (table) {
        const result = (table as any).results?.find((res: Result) => res.player_id === p.id)
        roundPoints.push(result?.point ?? null)
      } else {
        roundPoints.push(null)
      }
    }
    const total = roundPoints.reduce((sum: number, pt) => sum + (pt ?? 0), 0) + (p.bonus ?? 0)
    return { player: p, total: Math.round(total * 10) / 10, roundPoints }
  }).sort((a, b) => b.total - a.total)

  const myTotal = standings.find(s => s.player.id === player.id)?.total ?? 0
  const myRank = standings.findIndex(s => s.player.id === player.id) + 1

  function getScore(resultId: string) {
    return scores[resultId] ?? { value: '', negative: false }
  }

  async function submitScores(table: Table) {
    const results = (table as any).results as Result[]
    if (!results) return
    setSubmitting(table.id)
    for (const result of results) {
      const sc = getScore(result.id)
      if (sc.value === '') continue
      const raw = parseInt(sc.value) * 100
      const score = sc.negative ? -raw : raw
      await supabase.from('results').update({ score }).eq('id', result.id)
    }
    setSubmitting(null)
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', padding: '16px' }}>
      <div style={{ maxWidth: '450px', margin: '0 auto' }}>
        <div style={{
          background: 'var(--navy)', borderRadius: '14px', padding: '20px',
          marginBottom: '12px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px',
            background: 'radial-gradient(circle, rgba(14,165,233,0.35), transparent 65%)',
            pointerEvents: 'none',
          }} />
          <div style={{ fontSize: '8.5px', fontFamily: 'monospace', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Yitia — Player View
          </div>
          <div style={{ fontFamily: 'serif', fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '0.07em', marginBottom: '12px' }}>
            {player.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '34px', fontWeight: 500, color: myTotal >= 0 ? '#7dd3fc' : '#fca5a5' }}>
              {myTotal >= 0 ? '+' : '▲'}{Math.abs(myTotal).toFixed(1)}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>pt</div>
            <div style={{ marginLeft: 'auto', background: 'var(--gold)', color: 'var(--navy)', fontFamily: 'serif', fontSize: '14px', fontWeight: 800, padding: '4px 11px', borderRadius: '7px' }}>
              {myRank}位
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(15,21,32,0.07)' }}>
          <div style={{ padding: '11px 15px', fontFamily: 'serif', fontSize: '13.5px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
            スコア入力
          </div>
          {Array.from({ length: tournament.num_rounds }, (_, i) => i + 1).map(roundNum => {
            const myTable = getMyTable(roundNum)
            if (!myTable) return (
              <div key={roundNum} style={{ padding: '11px 15px', borderBottom: '1px solid var(--paper)', fontSize: '12.5px', color: 'var(--mist)' }}>
                {roundNum}回戦 — 卓なし
              </div>
            )
            const results: Result[] = (myTable as any).results ?? []
            const myResult = results.find(r => r.player_id === player.id)
            const isValidated = myTable.is_validated
            return (
              <div key={roundNum} style={{ padding: '11px 15px', borderBottom: '1px solid var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {roundNum}回戦 — 卓{myTable.table_number}
                    {!noSeat && (
                      <span style={{ fontSize: '9.5px', fontFamily: 'monospace', color: 'var(--mist)' }}>
                        ({SEAT_LABELS[myResult?.seat_index ?? 0]}家)
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '9.5px', padding: '2px 7px', borderRadius: '9px', fontFamily: 'monospace',
                    background: isValidated ? 'var(--cyan-pale)' : 'var(--gold-pale)',
                    color: isValidated ? 'var(--cyan-deep)' : 'var(--gold-dark)',
                  }}>{isValidated ? '確定済み' : '入力中'}</span>
                </div>
                {isValidated ? (
                  <div>
                    <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '27px', fontWeight: 500, color: (myResult?.point ?? 0) >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                        {formatPoint(myResult?.point ?? 0)}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--mist)', marginTop: '2px' }}>{Math.floor(myResult?.rank ?? 0)}位</div>
                      <div style={{ fontSize: '10px', color: 'var(--mist)', marginTop: '1px', fontFamily: 'monospace' }}>素点 {((myResult?.score ?? 0) / 100).toLocaleString()}00</div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--paper)', paddingTop: '8px' }}>
                      <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: 'var(--cyan-deep)', marginBottom: '6px' }}>卓{myTable.table_number} 全員の結果</div>
                      {sortResults(results).map((r, ri) => {
                        const rPlayer = players.find(p => p.id === r.player_id)
                        const isMe = r.player_id === player.id
                        const sc2 = noSeat ? NUM_COLOR : SEAT_COLORS[r.seat_index]
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid var(--paper)' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: noSeat ? '4px' : '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: noSeat ? '10px' : '9px', fontWeight: 700, fontFamily: noSeat ? 'monospace' : 'serif', background: sc2.bg, color: sc2.color, flexShrink: 0 }}>
                              {noSeat ? `${ri + 1}` : SEAT_LABELS[r.seat_index]}
                            </div>
                            <div style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: isMe ? 'var(--cyan-deep)' : 'var(--ink)' }}>
                              {isMe ? '' : ''}{rPlayer?.name}
                            </div>
                            <span style={{ fontSize: '9px', color: 'var(--mist)', fontFamily: 'monospace', minWidth: '38px', textAlign: 'right' }}>{(r.score / 100).toLocaleString()}00</span>
                            <span style={{ fontSize: '10px', color: 'var(--mist)', fontFamily: 'monospace' }}>{Math.floor(r.rank)}位</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '11.5px', fontWeight: 600, minWidth: '52px', textAlign: 'right', color: r.point >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                              {formatPoint(r.point)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: 'var(--cyan-deep)', marginBottom: '8px' }}>
                      卓{myTable.table_number} スコア入力（全員分）
                    </div>
                    {sortResults(results).map((r, ri) => {
                      const rPlayer = players.find(p => p.id === r.player_id)
                      const isMe = r.player_id === player.id
                      const sc = getScore(r.id)
                      const sc2 = noSeat ? NUM_COLOR : SEAT_COLORS[r.seat_index]
                      const isSwapSelected = swapSource?.resultId === r.id
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid var(--paper)', background: isSwapSelected ? 'var(--cyan-pale)' : 'transparent', borderRadius: isSwapSelected ? '6px' : '0' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: noSeat ? '4px' : '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: noSeat ? '10px' : '9px', fontWeight: 700, fontFamily: noSeat ? 'monospace' : 'serif', background: sc2.bg, color: sc2.color, flexShrink: 0 }}>
                            {noSeat ? `${ri + 1}` : SEAT_LABELS[r.seat_index]}
                          </div>
                          <div
                            onClick={noSeat ? () => {
                              if (swapping) return
                              if (!swapSource) {
                                setSwapSource({ resultId: r.id, playerId: r.player_id })
                              } else if (swapSource.resultId === r.id) {
                                setSwapSource(null)
                              } else {
                                handleSwapInTable(swapSource.resultId, r.player_id)
                              }
                            } : undefined}
                            style={{
                              flex: 1, fontSize: '12px', fontWeight: 600,
                              color: isMe ? 'var(--cyan-deep)' : 'var(--ink)',
                              cursor: noSeat ? 'pointer' : 'default',
                              padding: noSeat ? '2px 6px' : '0',
                              borderRadius: noSeat ? '4px' : '0',
                              border: noSeat ? `1px dashed ${isSwapSelected ? 'var(--cyan-deep)' : 'transparent'}` : 'none',
                            }}
                          >
                            {rPlayer?.name}
                          </div>
                          <button onClick={() => setScores(s => ({ ...s, [r.id]: { ...sc, negative: !sc.negative } }))} style={{
                            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                            border: `1.5px solid ${sc.negative ? 'rgba(239,68,68,0.3)' : 'var(--border-md)'}`,
                            background: sc.negative ? 'var(--red-pale)' : 'var(--paper)',
                            color: sc.negative ? 'var(--red)' : 'var(--mist)',
                            fontSize: '9px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>▲</button>
                          <input
                            type="number"
                            value={sc.value}
                            onChange={e => setScores(s => ({ ...s, [r.id]: { ...sc, value: e.target.value } }))}
                            placeholder={(tournament.config.startingPoints / 100).toString()}
                            style={{
                              width: '70px', padding: '4px 6px',
                              border: '1.5px solid var(--border-md)', borderRadius: '6px',
                              fontSize: '11.5px', fontWeight: 600, textAlign: 'right',
                              fontFamily: 'monospace', background: 'var(--paper)', outline: 'none',
                            }}
                          />
                          <span style={{ fontSize: '9.5px', color: 'var(--mist)', fontFamily: 'monospace', flexShrink: 0 }}>00</span>
                        </div>
                      )
                    })}
                    <button onClick={() => submitScores(myTable)} disabled={submitting === myTable.id} style={{
                      width: '100%', marginTop: '10px', padding: '8px',
                      background: submitting === myTable.id ? 'var(--mist)' : 'var(--cyan-deep)',
                      color: '#fff', border: 'none', borderRadius: '7px',
                      fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                    }}>{submitting === myTable.id ? '送信中...' : 'スコアを送信'}</button>
                    <div style={{ fontSize: '10.5px', color: 'var(--mist)', marginTop: '6px' }}>
                      ※管理者が確定するまで仮入力扱いです
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(15,21,32,0.07)' }}>
          <div style={{ padding: '11px 15px', fontFamily: 'serif', fontSize: '13.5px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
            全体成績
          </div>
          {standings.map((s, i) => {
            const isMe = s.player.id === player.id
            return (
              <div key={s.player.id} style={{
                padding: '8px 15px', borderBottom: '1px solid var(--paper)',
                background: isMe ? 'var(--cyan-pale)' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--mist)', width: '20px', textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, color: isMe ? 'var(--cyan-deep)' : 'var(--ink)' }}>
                    {isMe ? '' : ''}{s.player.name}{isMe ? '（自分）' : ''}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12.5px', fontWeight: 600, color: s.total >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                    {formatPoint(s.total)}
                  </div>
                </div>
                {s.roundPoints.some(pt => pt !== null) && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px', paddingLeft: '28px', flexWrap: 'wrap' }}>
                    {s.roundPoints.map((pt, ri) => (
                      <span key={ri} style={{
                        fontSize: '9.5px', fontFamily: 'monospace', padding: '1px 5px',
                        borderRadius: '4px', background: 'var(--paper)',
                        color: pt === null ? 'var(--mist)' : pt >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                      }}>
                        R{ri + 1}:{pt !== null ? formatPoint(pt) : '-'}
                      </span>
                    ))}
                    {(s.player.bonus ?? 0) !== 0 && (
                      <span style={{
                        fontSize: '9.5px', fontFamily: 'monospace', padding: '1px 5px',
                        borderRadius: '4px', background: 'var(--red-pale)',
                        color: 'var(--red)',
                      }}>
                        調整:{formatPoint(s.player.bonus)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(15,21,32,0.07)' }}>
          <div style={{ padding: '11px 15px', fontFamily: 'serif', fontSize: '13.5px', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
            得点調整
          </div>
          <div style={{ padding: '12px 15px' }}>
            <div style={{ fontSize: '11px', color: 'var(--mist)', marginBottom: '8px' }}>
              チョンボ等のペナルティや調整ポイントを入力してください
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={() => setAdjustmentNeg(n => !n)} style={{
                width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                border: `1.5px solid ${adjustmentNeg ? 'rgba(239,68,68,0.3)' : 'var(--border-md)'}`,
                background: adjustmentNeg ? 'var(--red-pale)' : 'var(--paper)',
                color: adjustmentNeg ? 'var(--red)' : 'var(--cyan-deep)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{adjustmentNeg ? '▲' : '+'}</button>
              <input
                type="number"
                value={adjustmentInput}
                onChange={e => setAdjustmentInput(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1, padding: '6px 8px',
                  border: '1.5px solid var(--border-md)', borderRadius: '6px',
                  fontSize: '13px', fontWeight: 600, textAlign: 'right',
                  fontFamily: 'monospace', background: 'var(--paper)', outline: 'none',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'monospace', flexShrink: 0 }}>pt</span>
              <button
                onClick={async () => {
                  setSavingAdjustment(true)
                  const val = parseFloat(adjustmentInput) || 0
                  const bonus = adjustmentNeg ? -Math.abs(val) : Math.abs(val)
                  await supabase.from('players').update({ bonus }).eq('id', player.id)
                  setSavingAdjustment(false)
                  router.refresh()
                }}
                disabled={savingAdjustment}
                style={{
                  padding: '6px 14px', flexShrink: 0,
                  background: savingAdjustment ? 'var(--mist)' : 'var(--cyan-deep)',
                  color: '#fff', border: 'none', borderRadius: '7px',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >{savingAdjustment ? '保存中...' : '保存'}</button>
            </div>
            {(player.bonus ?? 0) !== 0 && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--mist)' }}>
                現在の調整: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: player.bonus < 0 ? 'var(--red)' : 'var(--cyan-deep)' }}>
                  {formatPoint(player.bonus)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--mist)', padding: '8px 0 24px', fontFamily: 'monospace' }}>
          Yitia — {tournament.name}
        </div>
      </div>
    </div>
  )
}
