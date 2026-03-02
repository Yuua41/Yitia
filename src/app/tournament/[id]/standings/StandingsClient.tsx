'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatPoint } from '@/lib/mahjong/calculator'
import type { Tournament, Player, Table, Result } from '@/types'

interface Props {
  tournament: Tournament
  players: Player[]
  tables: Table[]
}

type SortKey = 'rank' | 'name' | 'total'
type SortDir = 'asc' | 'desc'

export default function StandingsClient({ tournament, players, tables }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [adjustments, setAdjustments] = useState<Record<string, number>>(
    Object.fromEntries(players.map(p => [p.id, p.bonus]))
  )
  const [savingAdj, setSavingAdj] = useState(false)

  const standings = players.map(player => {
    const roundPoints: (number | null)[] = Array(tournament.num_rounds).fill(null)
    tables.forEach(table => {
      const results = (table as any).results as Result[]
      const result = results?.find(r => r.player_id === player.id)
      if (result && result.point !== 0) {
        roundPoints[table.round_number - 1] = result.point
      }
    })
    const base = roundPoints.reduce<number>((sum, p) => sum + (p ?? 0), 0)
    const adj = adjustments[player.id] ?? 0
    const total = Math.round((base + adj) * 10) / 10
    return { player, roundPoints, base, total }
  })

  const ranked = standings
    .sort((a, b) => b.total - a.total)
    .map((s, i, arr) => {
      const rank = arr.slice(0, i).filter(x => x.total === s.total).length + i + 1
      return { ...s, rank }
    })

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

  async function saveAdjustments() {
    setSavingAdj(true)
    for (const [playerId, bonus] of Object.entries(adjustments)) {
      await supabase.from('players').update({ bonus }).eq('id', playerId)
    }
    setSavingAdj(false)
    router.refresh()
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return '↕'
    return sortDir === 'asc' ? '▲' : '▼'
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
      <div style={{
        height: '52px', background: '#fff', borderBottom: '1px solid var(--border)',
        padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{tournament.name} › </span>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>成績</span>
        </div>
        <button onClick={saveAdjustments} disabled={savingAdj} style={{
          padding: '6px 14px', background: 'var(--gold)', color: 'var(--navy)',
          border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
          cursor: 'pointer', opacity: savingAdj ? 0.6 : 1,
        }}>
          {savingAdj ? '保存中...' : 'ポイント調整を保存'}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px' }}>
        <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800, marginBottom: '3px' }}>総合成績</div>
        <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '20px' }}>
          {tournament.name} — {tables.length} / {tournament.num_rounds * Math.floor(players.length / 4)} 試合確定済み
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 1px 8px rgba(15,21,32,0.07)', overflowX: 'auto' }}>
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
              {sorted.map(({ player, roundPoints, total, rank }) => {
                const rkBg = rank === 1 ? 'var(--gold)' : rank === 2 ? 'var(--slate)' : rank === 3 ? '#94a3b8' : 'var(--paper)'
                const rkColor = rank <= 3 ? '#fff' : 'var(--slate)'
                const adj = adjustments[player.id] ?? 0
                return (
                  <tr key={player.id}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--paper)' }}>
                      <span style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 800, fontFamily: 'serif',
                        background: rkBg, color: rkColor,
                      }}>{rank}</span>
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
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--paper)', textAlign: 'right' }}>
                      <strong style={{
                        fontFamily: 'monospace', fontSize: '14px',
                        color: total >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                      }}>{formatPoint(total)}</strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
