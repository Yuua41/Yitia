'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcStandings, formatPoint } from '@/lib/mahjong/calculator'
import type { Tournament, Player, Table } from '@/types'
import HeaderIcons from '@/components/ui/HeaderIcons'

interface Props {
  tournament: Tournament
  players: Player[]
  tables: Table[]
  isOwner: boolean
}

type SortKey = 'rank' | 'name' | 'total'
type SortDir = 'asc' | 'desc'

/** 表示済みラウンドまでの累計を滑らかにアニメーション */
function RevealScore({ roundPoints, adjustment, revealedCol, fontSize = '14px' }: {
  roundPoints: (number | null)[]; adjustment: number; revealedCol: number; fontSize?: string
}) {
  const target = roundPoints.slice(0, revealedCol).reduce<number>((s, p) => s + (p ?? 0), 0) + adjustment
  const rounded = Math.round(target * 10) / 10
  const [display, setDisplay] = useState(rounded)
  const prevRef = useRef(rounded)

  useEffect(() => {
    const from = prevRef.current
    const to = rounded
    if (from === to) return
    const duration = 300
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round((from + (to - from) * eased) * 10) / 10)
      if (t < 1) requestAnimationFrame(tick)
      else { setDisplay(to); prevRef.current = to }
    }
    requestAnimationFrame(tick)
  }, [rounded])

  return (
    <strong style={{
      fontFamily: 'monospace', fontSize, position: 'relative',
      color: display >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
      transition: 'color 0.3s',
    }}>{formatPoint(display)}</strong>
  )
}

export default function StandingsClient({ tournament, players, tables, isOwner }: Props) {
  const supabase = createClient()
  const [localPlayers, setLocalPlayers] = useState(players)
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [adjustments, setAdjustments] = useState<Record<string, number>>(
    Object.fromEntries(players.map(p => [p.id, p.bonus]))
  )
  const [savingAdj, setSavingAdj] = useState(false)
  const [revealedCol, setRevealedCol] = useState(0)

  useEffect(() => {
    if (revealedCol >= tournament.num_rounds) return
    const t = setTimeout(() => setRevealedCol(c => c + 1), 220)
    return () => clearTimeout(t)
  }, [revealedCol, tournament.num_rounds])

  const ranked = calcStandings(localPlayers, tables, tournament.num_rounds, adjustments)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'total' ? 'desc' : 'asc')
    }
  }

  const sorted = [...ranked].sort((a, b) => {
    let va: number, vb: number
    if (sortKey === 'rank') { va = a.rank; vb = b.rank }
    else if (sortKey === 'name') { va = a.player.seat_order; vb = b.player.seat_order }
    else { va = a.total; vb = b.total }
    return sortDir === 'asc' ? va - vb : vb - va
  })

  const maxAbs = Math.max(...sorted.map(s => Math.abs(s.total)), 1)

  async function saveAdjustments() {
    setSavingAdj(true)
    for (const [playerId, bonus] of Object.entries(adjustments)) {
      await supabase.from('players').update({ bonus }).eq('id', playerId)
    }
    setLocalPlayers(prev => prev.map(p => ({ ...p, bonus: adjustments[p.id] ?? p.bonus })))
    setSavingAdj(false)
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return '↕'
    return sortDir === 'asc' ? '▲' : '▼'
  }

  function exportCSV() {
    const header = [
      '順位', '名前',
      ...Array.from({ length: tournament.num_rounds }, (_, i) => `R${i + 1}`),
      '調整', '合計',
    ]
    const rows = sorted.map(({ player, roundPoints, total, rank }) => [
      rank,
      player.name,
      ...roundPoints.map(p => p !== null ? formatPoint(p) : ''),
      adjustments[player.id] ?? 0,
      formatPoint(total),
    ])
    const bom = '\uFEFF'
    const csv = bom + [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tournament.name}_成績.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function rankBadgeStyle(rank: number): React.CSSProperties {
    if (rank === 1) return {
      background: 'linear-gradient(135deg, #D4AF37, #F5D060)',
      color: '#2a2000',
      boxShadow: '0 0 12px rgba(212,175,55,0.5), 0 0 4px rgba(212,175,55,0.3)',
    }
    if (rank === 2) return {
      background: 'linear-gradient(135deg, #8C9298, #C0C8D0)',
      color: '#1a1a2a',
      boxShadow: '0 0 8px rgba(192,200,208,0.3)',
    }
    if (rank === 3) return {
      background: 'linear-gradient(135deg, #A0522D, #CD8032)',
      color: '#2a1500',
      boxShadow: '0 0 8px rgba(205,128,50,0.3)',
    }
    return { background: 'var(--paper)', color: 'var(--slate)', border: '1px solid rgba(0,240,255,0.08)' }
  }

  const thStyle = (key?: SortKey): React.CSSProperties => ({
    padding: '8px 12px', textAlign: 'left',
    fontSize: '9.5px', fontFamily: 'monospace', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: key && sortKey === key ? 'var(--cyan-deep)' : 'var(--mist)',
    borderBottom: '1.5px solid var(--border)', whiteSpace: 'nowrap',
    cursor: key ? 'pointer' : 'default', userSelect: 'none',
  })

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .standings-table-view { display: block; }
        .standings-card-view { display: none !important; }
        .standings-header { padding: 0 26px !important; }
        .standings-header-btns { display: flex; }
        .standings-content { padding: 24px 26px !important; }
        .standings-content-btns { display: none; }
        @media (max-width: 768px) {
          .standings-table-view { display: none !important; }
          .standings-card-view { display: flex !important; }
          .standings-header { padding: 0 16px !important; }
          .standings-header-btns { display: none !important; }
          .standings-content { padding: 16px !important; }
          .standings-content-btns { display: flex !important; }
        }
        @keyframes stRowSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes stBarGrow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes stPointSlide {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes stMedalPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @keyframes stCardPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes stChipPop {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes stShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes stTitleFade {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes stSubFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes stTitleShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes stChartFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes stCellReveal {
          from { opacity: 0; transform: translateY(-6px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="standings-header" style={{
        height: '52px', background: 'rgba(10,14,30,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,240,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mist)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tournament.name}</span>
        <HeaderIcons />
      </div>
      <div className="standings-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{
            fontFamily: 'serif', fontSize: '20px', fontWeight: 800,
            background: 'linear-gradient(90deg, var(--ink) 20%, var(--cyan) 40%, var(--gold) 60%, var(--ink) 80%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'stTitleFade 0.5s ease both, stTitleShimmer 4s linear 1s infinite',
          }}>総合成績</div>
          <div className="standings-header-btns" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={exportCSV} style={{
              padding: '6px 14px', background: 'transparent', color: '#AD30F2',
              border: '1.5px solid #AD30F2', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}>CSV出力</button>
            {isOwner && (
              <button onClick={saveAdjustments} disabled={savingAdj} style={{
                padding: '6px 14px', background: 'transparent', color: 'var(--cyan-deep)',
                border: '1.5px solid var(--cyan-deep)', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', opacity: savingAdj ? 0.6 : 1,
              }}>
                {savingAdj ? '保存中...' : '調整を保存'}
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '12px', animation: 'stSubFade 0.6s ease 0.2s both' }}>
          {tournament.name} — {tables.length} / {tournament.num_rounds * Math.floor(players.length / 4)} 試合確定済み
        </div>
        <div className="standings-content-btns" style={{ gap: '8px', marginBottom: '16px' }}>
          <button onClick={exportCSV} style={{
            padding: '8px 16px', background: 'transparent', color: '#AD30F2',
            border: '1.5px solid #AD30F2', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', flex: 1,
          }}>CSV出力</button>
          {isOwner && (
            <button onClick={saveAdjustments} disabled={savingAdj} style={{
              padding: '8px 16px', background: 'transparent', color: 'var(--cyan-deep)',
              border: '1.5px solid var(--cyan-deep)', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', opacity: savingAdj ? 0.6 : 1, flex: 1,
            }}>
              {savingAdj ? '保存中...' : '調整を保存'}
            </button>
          )}
        </div>

        {/* Desktop: Table View */}
        <div className="standings-table-view">
          <div style={{ background: 'rgba(15,21,40,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(0,240,255,0.10)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr>
                  <th style={thStyle('rank')} onClick={() => handleSort('rank')}>順位 <span>{sortIcon('rank')}</span></th>
                  <th style={thStyle('name')} onClick={() => handleSort('name')}>名前（参加順） <span>{sortIcon('name')}</span></th>
                  {Array.from({ length: tournament.num_rounds }, (_, i) => (
                    <th key={i} style={thStyle()}>R{i + 1}</th>
                  ))}
                  <th style={thStyle()}>ポイント調整</th>
                  <th style={{ ...thStyle('total'), textAlign: 'right' }} onClick={() => handleSort('total')}>合計 <span>{sortIcon('total')}</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ player, roundPoints, total, rank, isTied }, idx) => {
                  const badge = rankBadgeStyle(rank)
                  const adj = adjustments[player.id] ?? 0
                  const barWidth = Math.abs(total) / maxAbs * 100
                  return (
                    <tr key={player.id} style={{
                      animation: `stRowSlide 0.3s ease ${idx * 40}ms both`,
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,240,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--paper)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <span style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 800, fontFamily: 'monospace',
                            ...badge,
                            animation: rank === 1 ? 'stMedalPulse 2.5s ease-in-out 600ms infinite' : 'none',
                          }}>{rank}</span>
                          {isTied && <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--mist)', fontWeight: 700 }}>T</span>}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--paper)', fontWeight: 600 }}>
                        {player.seat_order + 1}. {player.name}
                      </td>
                      {roundPoints.map((pt, i) => (
                        <td key={i} style={{
                          padding: '10px 12px', borderBottom: '1px solid var(--paper)',
                          fontFamily: 'monospace', fontWeight: 600,
                          color: pt === null ? 'var(--mist)' : pt >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                          opacity: i < revealedCol ? 1 : 0,
                          animation: i < revealedCol ? `stCellReveal 0.25s ease-out both` : 'none',
                        }}>{pt === null ? '—' : formatPoint(pt)}</td>
                      ))}
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--paper)' }}>
                        {isOwner ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => {
                                const cur = adjustments[player.id] ?? 0
                                setAdjustments(a => ({ ...a, [player.id]: -cur }))
                              }}
                              style={{
                                width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                                border: `1.5px solid ${adj < 0 ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                                background: adj < 0 ? 'var(--red-pale)' : 'var(--paper)',
                                color: adj < 0 ? 'var(--red)' : 'var(--mist)',
                                fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >▲</button>
                            <input
                              type="number"
                              value={Math.abs(adj)}
                              onChange={e => {
                                const v = Math.abs(+e.target.value)
                                setAdjustments(a => ({ ...a, [player.id]: adj < 0 ? -v : v }))
                              }}
                              style={{
                                width: '58px', padding: '4px 6px',
                                border: `1.5px solid ${adj < 0 ? 'rgba(239,68,68,0.3)' : adj > 0 ? 'rgba(0,240,255,0.3)' : 'var(--border)'}`,
                                borderRadius: '6px', fontSize: '11.5px', fontFamily: 'monospace',
                                textAlign: 'center', outline: 'none',
                                background: adj < 0 ? 'var(--red-pale)' : adj > 0 ? 'rgba(0,240,255,0.08)' : 'var(--paper)',
                                color: adj < 0 ? 'var(--red)' : adj > 0 ? 'var(--cyan-deep)' : 'var(--ink)',
                              }}
                            />
                          </div>
                        ) : (
                          <span style={{
                            fontFamily: 'monospace', fontSize: '11.5px',
                            color: adj < 0 ? 'var(--red)' : adj > 0 ? 'var(--gold-dark)' : 'var(--mist)',
                          }}>{adj !== 0 ? formatPoint(adj) : '—'}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--paper)', textAlign: 'right', position: 'relative' }}>
                        <div style={{
                          position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: `${barWidth}%`,
                          background: total >= 0
                            ? 'linear-gradient(270deg, rgba(0,240,255,0.12), transparent)'
                            : 'linear-gradient(270deg, rgba(239,68,68,0.10), transparent)',
                          transformOrigin: 'right',
                          animation: `stBarGrow 0.6s ease ${idx * 40 + 200}ms both`,
                        }} />
                        <RevealScore roundPoints={roundPoints} adjustment={adj} revealedCol={revealedCol} fontSize="14px" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: Card View */}
        <div className="standings-card-view" style={{ flexDirection: 'column', gap: '10px' }}>
          {sorted.map(({ player, roundPoints, total, rank }, idx) => {
            const badge = rankBadgeStyle(rank)
            const adj = adjustments[player.id] ?? 0
            const barWidth = Math.abs(total) / maxAbs * 100
            return (
              <div key={player.id} style={{
                background: 'rgba(15,21,40,0.5)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(0,240,255,0.10)', borderRadius: '12px',
                padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                position: 'relative', overflow: 'hidden',
                animation: `stCardPop 0.3s ease ${idx * 50}ms both`,
              }}>
                {/* score bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${barWidth}%`,
                  background: total >= 0
                    ? 'linear-gradient(90deg, rgba(0,240,255,0.06), rgba(0,240,255,0.14))'
                    : 'linear-gradient(90deg, rgba(239,68,68,0.05), rgba(239,68,68,0.11))',
                  transformOrigin: 'left',
                  animation: `stBarGrow 0.6s ease ${idx * 50 + 200}ms both`,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', position: 'relative' }}>
                  <span style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 800, fontFamily: 'monospace',
                    flexShrink: 0, ...badge,
                    animation: rank === 1 ? 'stMedalPulse 2.5s ease-in-out 600ms infinite' : 'none',
                  }}>{rank}</span>
                  <div style={{ flex: 1, fontSize: '13.5px', fontWeight: 700 }}>
                    {player.seat_order + 1}. {player.name}
                  </div>
                  <RevealScore roundPoints={roundPoints} adjustment={adjustments[player.id] ?? 0} revealedCol={revealedCol} fontSize="16px" />
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px', position: 'relative' }}>
                  {roundPoints.map((pt, i) => (
                    <span key={i} style={{
                      fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px',
                      borderRadius: '4px', background: 'rgba(0,240,255,0.06)',
                      color: pt === null ? 'var(--mist)' : pt >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                      fontWeight: 600,
                      opacity: i < revealedCol ? 1 : 0,
                      animation: i < revealedCol ? `stChipPop 0.2s ease ${idx * 50 + 300 + i * 60}ms both` : 'none',
                    }}>
                      R{i + 1}:{pt !== null ? formatPoint(pt) : '-'}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--mist)', position: 'relative' }}>
                  <span>調整:</span>
                  {isOwner ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => {
                          const cur = adjustments[player.id] ?? 0
                          setAdjustments(a => ({ ...a, [player.id]: -cur }))
                        }}
                        style={{
                          width: '30px', height: '30px', borderRadius: '6px', flexShrink: 0,
                          border: `1.5px solid ${adj < 0 ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                          background: adj < 0 ? 'var(--red-pale)' : 'var(--paper)',
                          color: adj < 0 ? 'var(--red)' : 'var(--mist)',
                          fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >▲</button>
                      <input
                        type="number"
                        value={Math.abs(adj)}
                        onChange={e => {
                          const v = Math.abs(+e.target.value)
                          setAdjustments(a => ({ ...a, [player.id]: adj < 0 ? -v : v }))
                        }}
                        style={{
                          width: '72px', padding: '5px 8px',
                          border: `1.5px solid ${adj < 0 ? 'rgba(239,68,68,0.3)' : adj > 0 ? 'rgba(0,240,255,0.3)' : 'var(--border)'}`,
                          borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace',
                          textAlign: 'center', outline: 'none',
                          background: adj < 0 ? 'var(--red-pale)' : adj > 0 ? 'rgba(0,240,255,0.08)' : 'var(--paper)',
                          color: adj < 0 ? 'var(--red)' : adj > 0 ? 'var(--cyan-deep)' : 'var(--ink)',
                        }}
                      />
                    </div>
                  ) : (
                    <span style={{
                      fontFamily: 'monospace', fontSize: '12px',
                      color: adj < 0 ? 'var(--red)' : adj > 0 ? 'var(--gold-dark)' : 'var(--mist)',
                    }}>{adj !== 0 ? formatPoint(adj) : '—'}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Point Progression Chart */}
        {tournament.num_rounds > 0 && ranked.length > 0 && (
          <PointChart ranked={ranked} numRounds={tournament.num_rounds} adjustments={adjustments} />
        )}
      </div>
    </div>
  )
}

/* ─── Animated Line Chart ─── */

const CHART_COLORS = [
  '#D4AF37', '#62c8e8', '#e86280', '#8BE88B', '#c49be8',
  '#e8a84c', '#4ce8c4', '#e8e84c', '#e87c4c', '#8888e8',
  '#e84ca0', '#4ca0e8', '#b8e84c', '#e84c4c', '#4ce8e8',
  '#c888d8', '#d8c870', '#70d8a0', '#d87088', '#88b0d8',
]

interface ChartEntry {
  player: Player
  roundPoints: (number | null)[]
  total: number
  rank: number
}

function PointChart({ ranked, numRounds, adjustments }: { ranked: ChartEntry[]; numRounds: number; adjustments: Record<string, number> }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0) // 0 → numRounds, float for smooth animation
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(600)
  const [isVisible, setIsVisible] = useState(false)
  const hasAnimated = useRef(false)

  // Observe container width for responsive SVG
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Trigger animation when chart scrolls into viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !hasAnimated.current) setIsVisible(true) },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Smooth animation: starts when chart becomes visible
  useEffect(() => {
    if (!isVisible) return
    hasAnimated.current = true
    setProgress(0)
    const duration = numRounds * 500 // 500ms per round
    let raf: number
    let start: number | null = null
    function animate(ts: number) {
      if (start === null) start = ts
      const elapsed = ts - start
      const t = Math.min(elapsed / duration, 1)
      // ease-out cubic for a decelerating feel
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(eased * numRounds)
      if (t < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [isVisible, numRounds])

  // Compute cumulative points per player
  const topN = ranked.slice(0, 20) // limit to top 20
  const cumulativeData = topN.map(entry => {
    const adj = adjustments[entry.player.id] ?? (entry.player.bonus ?? 0)
    const cumulative: number[] = [adj] // start from adjustment
    let sum = adj
    for (let r = 0; r < numRounds; r++) {
      sum += entry.roundPoints[r] ?? 0
      cumulative.push(Math.round(sum * 10) / 10)
    }
    return { player: entry.player, cumulative, rank: entry.rank }
  })

  // Chart dimensions
  const marginLeft = 50
  const marginRight = 16
  const marginTop = 16
  const marginBottom = 32
  const chartWidth = containerWidth - marginLeft - marginRight
  const height = 280
  const chartHeight = height - marginTop - marginBottom

  // Scale
  const allValues = cumulativeData.flatMap(d => d.cumulative)
  const minVal = Math.min(0, ...allValues)
  const maxVal = Math.max(0, ...allValues)
  const range = maxVal - minVal || 1
  const padding = range * 0.1

  const scaleX = (round: number) => marginLeft + (round / numRounds) * chartWidth
  const scaleY = (val: number) => marginTop + chartHeight - ((val - minVal + padding) / (range + padding * 2)) * chartHeight


  return (
    <div ref={containerRef} style={{
      marginTop: '24px',
      background: 'rgba(15,21,40,0.5)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(0,240,255,0.10)',
      borderRadius: '12px',
      padding: '16px 8px 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      animation: 'stChartFade 0.5s ease 0.3s both',
    }}>
      <div style={{
        fontSize: '13px', fontWeight: 700, marginBottom: '8px', paddingLeft: '8px',
        color: 'var(--ink)',
      }}>ポイント推移</div>
      <svg
        ref={svgRef}
        width={containerWidth}
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Grid lines — always include 0 */}
        {(() => {
          // Build nice rounded grid values that always include 0
          const rawStep = (maxVal - minVal + padding * 2) / 4
          // Round step to a nice number (10, 20, 25, 50, 100, etc.)
          const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))))
          const niceSteps = [1, 2, 2.5, 5, 10]
          const niceStep = niceSteps.find(s => s * mag >= rawStep)! * mag
          const gridVals = new Set<number>()
          gridVals.add(0) // always show zero
          // Add grid lines above and below 0
          for (let v = niceStep; v <= maxVal + padding; v += niceStep) gridVals.add(Math.round(v))
          for (let v = -niceStep; v >= minVal - padding; v -= niceStep) gridVals.add(Math.round(v))
          return Array.from(gridVals).sort((a, b) => a - b).map(val => {
            const y = scaleY(val)
            const isZero = val === 0
            return (
              <g key={`grid-${val}`}>
                <line x1={marginLeft} y1={y} x2={marginLeft + chartWidth} y2={y}
                  stroke={isZero ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth={1}
                  strokeDasharray={isZero ? '4 3' : 'none'} />
                <text x={marginLeft - 6} y={y + 3.5}
                  fill={isZero ? 'var(--ink)' : 'var(--mist)'}
                  fontSize="9" fontFamily="monospace" textAnchor="end"
                  fontWeight={isZero ? 700 : 400}>
                  {Number.isInteger(val) ? val : val.toFixed(1)}
                </text>
              </g>
            )
          })
        })()}

        {/* Round labels */}
        {Array.from({ length: numRounds + 1 }, (_, i) => (
          <text key={`rl-${i}`} x={scaleX(i)} y={height - 6}
            fill={i <= progress ? 'var(--mist)' : 'rgba(255,255,255,0.1)'}
            fontSize="9" fontFamily="monospace" textAnchor="middle"
            style={{ transition: 'fill 0.3s' }}>
            {i === 0 ? '開始' : `R${i}`}
          </text>
        ))}

        {/* Vertical round markers */}
        {Array.from({ length: numRounds + 1 }, (_, i) => (
          <line key={`vl-${i}`}
            x1={scaleX(i)} y1={marginTop} x2={scaleX(i)} y2={marginTop + chartHeight}
            stroke={i <= progress ? 'rgba(15,21,40,0.5)' : 'transparent'}
            strokeWidth={1}
            style={{ transition: 'stroke 0.3s' }} />
        ))}

        {/* Lines */}
        {cumulativeData.map((data, idx) => {
          const color = CHART_COLORS[idx % CHART_COLORS.length]
          const isHovered = hoveredPlayer === data.player.id
          const isAnyHovered = hoveredPlayer !== null
          const opacity = isAnyHovered ? (isHovered ? 1 : 0.12) : 0.75
          const strokeW = isHovered ? 3 : 1.8

          // Build path up to progress (smooth interpolation between rounds)
          const completedRounds = Math.floor(progress)
          const frac = progress - completedRounds
          const points: string[] = []
          for (let r = 0; r <= Math.min(completedRounds, numRounds); r++) {
            points.push(`${scaleX(r)},${scaleY(data.cumulative[r])}`)
          }
          // Interpolate to fractional position between rounds
          if (frac > 0 && completedRounds < numRounds) {
            const nextR = completedRounds + 1
            const prevVal = data.cumulative[completedRounds]
            const nextVal = data.cumulative[nextR]
            const interpVal = prevVal + (nextVal - prevVal) * frac
            const interpX = scaleX(completedRounds + frac)
            const interpY = scaleY(interpVal)
            points.push(`${interpX},${interpY}`)
          }
          const d = points.length > 0 ? `M${points.join('L')}` : ''

          // End position for dot & tooltip
          const endRound = Math.min(progress, numRounds)
          const endComplete = Math.floor(endRound)
          const endFrac = endRound - endComplete
          let endX: number, endY: number
          if (endFrac > 0 && endComplete < numRounds) {
            const prevVal = data.cumulative[endComplete]
            const nextVal = data.cumulative[endComplete + 1]
            endX = scaleX(endRound)
            endY = scaleY(prevVal + (nextVal - prevVal) * endFrac)
          } else {
            endX = scaleX(endComplete)
            endY = scaleY(data.cumulative[endComplete])
          }

          return (
            <g key={data.player.id}
              onMouseEnter={() => setHoveredPlayer(data.player.id)}
              onMouseLeave={() => setHoveredPlayer(null)}
              style={{ cursor: 'pointer' }}>
              {/* Wider invisible hit area */}
              <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
              {/* Visible line */}
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={strokeW}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
                style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
              />
              {/* End dot */}
              {progress > 0 && (
                <circle
                  cx={endX}
                  cy={endY}
                  r={isHovered ? 5 : 3}
                  fill={color}
                  opacity={opacity}
                  style={{ transition: 'r 0.2s, opacity 0.2s' }}
                />
              )}
              {/* Label on hover */}
              {isHovered && progress > 0 && (() => {
                const lastR = Math.min(Math.floor(progress), numRounds)
                const cx = endX
                const cy = endY
                const labelRight = cx > marginLeft + chartWidth * 0.7
                return (
                  <g>
                    <rect
                      x={labelRight ? cx - 78 : cx + 8}
                      y={cy - 20}
                      width={70} height={28}
                      rx={5}
                      fill="rgba(0,0,0,0.8)"
                      stroke={color}
                      strokeWidth={1}
                    />
                    <text
                      x={labelRight ? cx - 43 : cx + 43}
                      y={cy - 8}
                      fill="#fff"
                      fontSize="9" fontFamily="monospace" fontWeight="700"
                      textAnchor="middle">
                      {data.player.name}
                    </text>
                    <text
                      x={labelRight ? cx - 43 : cx + 43}
                      y={cy + 3}
                      fill={color}
                      fontSize="10" fontFamily="monospace" fontWeight="700"
                      textAnchor="middle">
                      {formatPoint(data.cumulative[lastR])}
                    </text>
                  </g>
                )
              })()}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 10px',
        padding: '8px 8px 0', fontSize: '10px', fontFamily: 'monospace',
      }}>
        {cumulativeData.map((data, idx) => {
          const color = CHART_COLORS[idx % CHART_COLORS.length]
          const isHovered = hoveredPlayer === data.player.id
          return (
            <span
              key={data.player.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                cursor: 'pointer',
                opacity: hoveredPlayer && !isHovered ? 0.3 : 1,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={() => setHoveredPlayer(data.player.id)}
              onMouseLeave={() => setHoveredPlayer(null)}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: color, display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ color: isHovered ? '#fff' : 'var(--mist)', fontWeight: isHovered ? 700 : 400, transition: 'color 0.2s' }}>
                {data.rank}. {data.player.name}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
