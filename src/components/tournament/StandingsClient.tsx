'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcStandings, formatPoint } from '@/lib/mahjong/calculator'
import type { Tournament, Player, Table } from '@/types'

interface Props {
  tournament: Tournament
  players: Player[]
  tables: Table[]
  isOwner: boolean
}

type SortKey = 'rank' | 'name' | 'total'
type SortDir = 'asc' | 'desc'

export default function StandingsClient({ tournament, players, tables, isOwner }: Props) {
  const supabase = createClient()
  const [localPlayers, setLocalPlayers] = useState(players)
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [adjustments, setAdjustments] = useState<Record<string, number>>(
    Object.fromEntries(players.map(p => [p.id, p.bonus]))
  )
  const [savingAdj, setSavingAdj] = useState(false)

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
      boxShadow: '0 0 8px rgba(212,175,55,0.4)',
    }
    if (rank === 2) return {
      background: 'linear-gradient(135deg, #8C9298, #C0C8D0)',
      color: '#1a1a2a',
    }
    if (rank === 3) return {
      background: 'linear-gradient(135deg, #A0522D, #CD8032)',
      color: '#2a1500',
    }
    return { background: 'var(--paper)', color: 'var(--slate)' }
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
      `}</style>
      <div className="standings-header" style={{
        height: '52px', background: 'rgba(14,26,24,0.82)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{tournament.name} › </span>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>全体成績</span>
        </div>
        <div className="standings-header-btns" style={{ display: 'flex', gap: '6px' }}>
          <button onClick={exportCSV} style={{
            padding: '6px 14px', background: 'transparent', color: 'var(--cyan-deep)',
            border: '1.5px solid var(--cyan-deep)', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer',
          }}>CSV出力</button>
          {isOwner && (
            <button onClick={saveAdjustments} disabled={savingAdj} style={{
              padding: '6px 14px', background: 'var(--gold)', color: 'var(--navy)',
              border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', opacity: savingAdj ? 0.6 : 1,
            }}>
              {savingAdj ? '保存中...' : '調整を保存'}
            </button>
          )}
        </div>
      </div>
      <div className="standings-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800, marginBottom: '3px' }}>総合成績</div>
        <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '12px' }}>
          {tournament.name} — {tables.length} / {tournament.num_rounds * Math.floor(players.length / 4)} 試合確定済み
        </div>
        <div className="standings-content-btns" style={{ gap: '8px', marginBottom: '16px' }}>
          <button onClick={exportCSV} style={{
            padding: '8px 16px', background: 'transparent', color: 'var(--cyan-deep)',
            border: '1.5px solid var(--cyan-deep)', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', flex: 1,
          }}>CSV出力</button>
          {isOwner && (
            <button onClick={saveAdjustments} disabled={savingAdj} style={{
              padding: '8px 16px', background: 'var(--gold)', color: 'var(--navy)',
              border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', opacity: savingAdj ? 0.6 : 1, flex: 1,
            }}>
              {savingAdj ? '保存中...' : '調整を保存'}
            </button>
          )}
        </div>

        {/* Desktop: Table View */}
        <div className="standings-table-view">
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', overflowX: 'auto' }}>
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
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
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
                        }}>{pt === null ? '—' : formatPoint(pt)}</td>
                      ))}
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--paper)' }}>
                        {isOwner ? (
                          <input
                            type="number"
                            value={adj}
                            onChange={e => setAdjustments(a => ({ ...a, [player.id]: +e.target.value }))}
                            style={{
                              width: '68px', padding: '4px 6px',
                              border: `1.5px solid ${adj < 0 ? 'rgba(239,68,68,0.3)' : adj > 0 ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                              borderRadius: '6px', fontSize: '11.5px', fontFamily: 'monospace',
                              textAlign: 'center', outline: 'none',
                              background: adj < 0 ? 'var(--red-pale)' : adj > 0 ? 'var(--gold-pale)' : 'var(--paper)',
                              color: adj < 0 ? 'var(--red)' : adj > 0 ? 'var(--gold-dark)' : 'var(--ink)',
                            }}
                          />
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
                            ? 'linear-gradient(270deg, rgba(173,165,130,0.12), transparent)'
                            : 'linear-gradient(270deg, rgba(239,68,68,0.10), transparent)',
                          transformOrigin: 'right',
                          animation: `stBarGrow 0.6s ease ${idx * 40 + 200}ms both`,
                        }} />
                        <strong style={{
                          fontFamily: 'monospace', fontSize: '14px', position: 'relative',
                          color: total >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                          animation: `stPointSlide 0.4s ease ${idx * 40 + 150}ms both`,
                        }}>{formatPoint(total)}</strong>
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
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px',
                padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                position: 'relative', overflow: 'hidden',
                animation: `stCardPop 0.3s ease ${idx * 50}ms both`,
              }}>
                {/* score bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${barWidth}%`,
                  background: total >= 0
                    ? 'linear-gradient(90deg, rgba(173,165,130,0.06), rgba(173,165,130,0.14))'
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
                  <strong style={{
                    fontFamily: 'monospace', fontSize: '16px',
                    color: total >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                    animation: `stPointSlide 0.4s ease ${idx * 50 + 150}ms both`,
                  }}>{formatPoint(total)}</strong>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px', position: 'relative' }}>
                  {roundPoints.map((pt, i) => (
                    <span key={i} style={{
                      fontSize: '10px', fontFamily: 'monospace', padding: '2px 6px',
                      borderRadius: '4px', background: 'rgba(255,255,255,0.08)',
                      color: pt === null ? 'var(--mist)' : pt >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                      fontWeight: 600,
                      animation: `stChipPop 0.2s ease ${idx * 50 + 300 + i * 60}ms both`,
                    }}>
                      R{i + 1}:{pt !== null ? formatPoint(pt) : '-'}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--mist)', position: 'relative' }}>
                  <span>調整:</span>
                  {isOwner ? (
                    <input
                      type="number"
                      value={adj}
                      onChange={e => setAdjustments(a => ({ ...a, [player.id]: +e.target.value }))}
                      style={{
                        width: '72px', padding: '5px 8px',
                        border: `1.5px solid ${adj < 0 ? 'rgba(239,68,68,0.3)' : adj > 0 ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                        borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace',
                        textAlign: 'center', outline: 'none',
                        background: adj < 0 ? 'var(--red-pale)' : adj > 0 ? 'var(--gold-pale)' : 'var(--paper)',
                        color: adj < 0 ? 'var(--red)' : adj > 0 ? 'var(--gold-dark)' : 'var(--ink)',
                      }}
                    />
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
      </div>
    </div>
  )
}
