'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcTableResults, calcStandings, formatPoint } from '@/lib/mahjong/calculator'
import type { Tournament, Player, Table, Result } from '@/types'

interface Props {
  player: Player
  tournament: Tournament
  players: Player[]
  tables: Table[]
}

const SEAT_LABELS = ['東', '南', '西', '北']
const SEAT_COLORS = [
  { bg: 'rgba(250,204,21,0.18)', color: '#fbbf24' },
  { bg: 'rgba(96,165,250,0.18)', color: '#60a5fa' },
  { bg: 'rgba(0,255,170,0.18)', color: '#00ffaa' },
  { bg: 'rgba(192,132,252,0.18)', color: '#c084fc' },
]
const NUM_COLOR = { bg: 'rgba(0,240,255,0.12)', color: 'var(--slate)' }

export default function PlayerClient({ player, tournament, players, tables }: Props) {
  const supabase = createClient()
  const [localTables, setLocalTables] = useState(tables)
  const [localPlayers, setLocalPlayers] = useState(players)
  const [localPlayer, setLocalPlayer] = useState(player)
  const [scores, setScores] = useState<Record<string, { value: string; negative: boolean }>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [adjustmentInput, setAdjustmentInput] = useState((player.bonus ?? 0) === 0 ? '' : Math.abs(player.bonus ?? 0).toString())
  const [adjustmentNeg, setAdjustmentNeg] = useState((player.bonus ?? 0) < 0)
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const [swapSource, setSwapSource] = useState<{ resultId: string; playerId: string } | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [extraSticks, setExtraSticks] = useState<Record<string, boolean>>({})
  const [validating, setValidating] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ score: false, adjustment: false, standings: false })
  const [displayAbsTotal, setDisplayAbsTotal] = useState(0)
  const [showRank, setShowRank] = useState(false)
  const [flashTableIds, setFlashTableIds] = useState<Set<string>>(new Set())
  const hasAnimated = useRef(false)
  const prevTablesRef = useRef(tables)
  const isFirstRenderRef = useRef(true)
  const standingsHasOpened = useRef(false)
  const [standingsAnimate, setStandingsAnimate] = useState(false)
  const scoreHasOpened = useRef(false)
  const [scoreAnimate, setScoreAnimate] = useState(false)

  const noSeat = tournament.config.seatMode === 'none'
  const allowPlayerEntry = tournament.config.allowPlayerEntry !== false

  // Force dark mode on player page
  useEffect(() => {
    const prev = document.body.getAttribute('data-theme')
    document.body.setAttribute('data-theme', 'dark')
    return () => {
      if (prev) document.body.setAttribute('data-theme', prev)
      else document.body.removeAttribute('data-theme')
    }
  }, [])

  // Refetch data from Supabase (client-side, no SSR roundtrip)
  const refetchData = useCallback(async () => {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase
        .from('tables')
        .select('*, results(*, player:players(name, seat_order))')
        .eq('tournament_id', tournament.id)
        .order('round_number')
        .order('table_number'),
      supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('seat_order'),
    ])
    if (t) setLocalTables(t)
    if (p) {
      setLocalPlayers(p)
      const me = p.find(x => x.id === player.id)
      if (me) {
        setLocalPlayer(me)
        setAdjustmentInput((me.bonus ?? 0) === 0 ? '' : Math.abs(me.bonus ?? 0).toString())
        setAdjustmentNeg((me.bonus ?? 0) < 0)
      }
    }
  }, [supabase, tournament.id, player.id])

  // Refetch on window focus for cross-client sync
  useEffect(() => {
    const handler = () => { refetchData() }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [refetchData])

  function sortResults(results: Result[]) {
    return [...results].sort((a, b) => a.seat_index - b.seat_index)
  }

  async function handleSwapInTable(sourceResultId: string, targetPlayerId: string) {
    const table = localTables.find(t => (t as any).results?.some((r: Result) => r.id === sourceResultId))
    if (!table) return
    const results = (table as any).results as Result[]
    const sourceResult = results.find(r => r.id === sourceResultId)
    const targetResult = results.find(r => r.player_id === targetPlayerId)
    if (!sourceResult || !targetResult) return

    setSwapping(true)
    const oldPlayerId = sourceResult.player_id
    await supabase.from('results').update({ player_id: targetPlayerId }).eq('id', sourceResult.id)
    await supabase.from('results').update({ player_id: oldPlayerId }).eq('id', targetResult.id)

    // Update local state
    setLocalTables(prev => prev.map(t => {
      if (t.id !== table.id) return t
      const updated = ((t as any).results as Result[])?.map(r => {
        if (r.id === sourceResult.id) return { ...r, player_id: targetPlayerId }
        if (r.id === targetResult.id) return { ...r, player_id: oldPlayerId }
        return r
      })
      return { ...t, results: updated }
    }))
    setSwapping(false)
    setSwapSource(null)
  }

  function getMyTable(roundNum: number) {
    return enrichedTables.find(t =>
      t.round_number === roundNum &&
      (t as any).results?.some((r: Result) => r.player_id === player.id)
    )
  }

  // Enrich submitted-but-not-validated tables with calculated points
  const enrichedTables = localTables.map(t => {
    if (t.is_submitted && !t.is_validated) {
      const results = (t as any).results as Result[]
      if (results?.length) {
        const calculated = calcTableResults(results, tournament.config)
        return { ...t, results: calculated.map(c => {
          const orig = results.find(r => r.id === c.id)
          return { ...orig, ...c }
        }) }
      }
    }
    return t
  })

  const standings = calcStandings(
    localPlayers,
    enrichedTables.filter(t => t.is_submitted),
    tournament.num_rounds
  )

  const myTotal = standings.find(s => s.player.id === player.id)?.total ?? 0
  const myRank = standings.find(s => s.player.id === player.id)?.rank ?? standings.length
  const standingsMaxAbs = Math.max(...standings.map(s => Math.abs(s.total)), 1)

  // ① カウントアップ: マウント時に 0 → myTotal を 800ms でカウント、終了後に順位を表示
  useEffect(() => {
    if (hasAnimated.current) {
      setDisplayAbsTotal(Math.abs(myTotal))
      return
    }
    hasAnimated.current = true
    const target = Math.abs(myTotal)
    const duration = 800
    const start = performance.now()
    let rafId: number
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayAbsTotal(parseFloat((eased * target).toFixed(1)))
      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      } else {
        setDisplayAbsTotal(target)
        setTimeout(() => setShowRank(true), 300)
      }
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [myTotal])

  // ⑤ 更新フラッシュ: localTables が変化した卓を検知してゴールドフラッシュ
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      prevTablesRef.current = localTables
      return
    }
    const changedIds = new Set<string>()
    localTables.forEach(t => {
      const prev = prevTablesRef.current.find(p => p.id === t.id)
      if (prev && JSON.stringify(prev) !== JSON.stringify(t)) changedIds.add(t.id)
    })
    prevTablesRef.current = localTables
    if (changedIds.size > 0) {
      setFlashTableIds(changedIds)
      standingsHasOpened.current = false // re-enable animations on next open
      scoreHasOpened.current = false
      const timer = setTimeout(() => setFlashTableIds(new Set()), 1500)
      return () => clearTimeout(timer)
    }
  }, [localTables])

  function toggleSection(key: string) {
    const opening = !openSections[key]
    if (key === 'standings' && opening) {
      setStandingsAnimate(!standingsHasOpened.current)
      standingsHasOpened.current = true
    }
    if (key === 'score' && opening) {
      setScoreAnimate(!scoreHasOpened.current)
      scoreHasOpened.current = true
    }
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function getScore(resultId: string) {
    return scores[resultId] ?? { value: '', negative: false }
  }

  async function submitScores(table: Table) {
    const results = (table as any).results as Result[]
    if (!results) return
    setSubmitting(table.id)
    const updatedResults = results.map(r => {
      const sc = getScore(r.id)
      if (sc.value === '') return r
      const raw = parseInt(sc.value) * 100
      const score = sc.negative ? -raw : raw
      return { ...r, score }
    })
    for (const result of updatedResults) {
      const orig = results.find(r => r.id === result.id)
      if (orig && result.score !== orig.score) {
        await supabase.from('results').update({ score: result.score }).eq('id', result.id)
      }
    }
    await supabase.from('tables').update({ is_submitted: true }).eq('id', table.id)

    // Update local state
    setLocalTables(prev => prev.map(t => {
      if (t.id !== table.id) return t
      return { ...t, is_submitted: true, results: updatedResults }
    }))
    setSubmitting(null)
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
      if (Math.abs(total - expected) > 100) {
        alert(`スコア合計が ${total.toLocaleString()} です。\n正しい合計は ${expected.toLocaleString()} のはずです。\n卓外点棒がある場合はチェックを入れてください。`)
        return
      }
    }

    const calculated = calcTableResults(scored, tournament.config)
    setValidating(table.id)
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
    setValidating(null)
  }

  async function handleUnvalidate(table: Table) {
    const results = (table as any).results as Result[]
    if (results) {
      const newScores = { ...scores }
      results.forEach(r => {
        newScores[r.id] = { value: (Math.abs(r.score) / 100).toString(), negative: r.score < 0 }
      })
      setScores(newScores)
      setExtraSticks(s => ({ ...s, [table.id]: table.has_extra_sticks }))
    }
    await supabase.from('tables').update({ is_validated: false }).eq('id', table.id)

    setLocalTables(prev => prev.map(t =>
      t.id === table.id ? { ...t, is_validated: false } : t
    ))
  }

  async function handleRevertSubmit(table: Table) {
    const results = (table as any).results as Result[]
    if (results) {
      const newScores = { ...scores }
      results.forEach(r => {
        newScores[r.id] = { value: (Math.abs(r.score) / 100).toString(), negative: r.score < 0 }
      })
      setScores(newScores)
    }
    await supabase.from('tables').update({ is_submitted: false }).eq('id', table.id)

    setLocalTables(prev => prev.map(t =>
      t.id === table.id ? { ...t, is_submitted: false } : t
    ))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '16px' }}>
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(1.18); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-7px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes flashCyan {
          0% { background-color: transparent; }
          20% { background-color: rgba(0,240,255,0.22); }
          100% { background-color: transparent; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: translateY(-5px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mePulse {
          0% { box-shadow: inset 0 0 0 1px rgba(0,240,255,0); }
          45% { box-shadow: inset 0 0 0 1px rgba(0,240,255,0.55); }
          100% { box-shadow: inset 0 0 0 1px rgba(0,240,255,0); }
        }
        @keyframes rankShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes standingsBarGrow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes pointSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes detailFadeIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 60px; }
        }
        @keyframes medalPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
      <div style={{ maxWidth: '450px', margin: '0 auto' }}>
        <div style={{
          background: 'var(--navy)', borderRadius: '14px', padding: '20px',
          marginBottom: '12px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px',
            background: `radial-gradient(circle, ${myTotal >= 0 ? 'rgba(0,240,255,0.35)' : 'rgba(239,68,68,0.28)'}, transparent 65%)`,
            pointerEvents: 'none',
            animation: 'breathe 3s ease-in-out infinite',
          }} />
          <div style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Yitia — Player View
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ fontFamily: 'serif', fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {localPlayer.name}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'monospace', fontSize: '52px', fontWeight: 700, color: myTotal >= 0 ? 'var(--cyan)' : 'var(--red)', lineHeight: 1 }}>
                {myTotal >= 0 ? '+' : '▲'}{displayAbsTotal.toFixed(1)}
              </div>
              <div style={{
                fontFamily: 'serif', fontSize: '18px', fontWeight: 800,
                marginTop: '4px', letterSpacing: '0.05em',
                opacity: showRank ? 1 : 0,
                transform: showRank ? 'translateY(0)' : 'translateY(6px)',
                transition: 'opacity 0.6s ease, transform 0.6s ease',
                background: 'linear-gradient(90deg, #00f0ff 20%, #ff00aa 50%, #00f0ff 80%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: showRank ? 'rankShimmer 3s linear infinite' : 'none',
              }}>
                総合 {myRank}位
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(15,21,40,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(0,240,255,0.10)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          <div onClick={() => toggleSection('score')} style={{ padding: '11px 15px', fontFamily: 'serif', fontSize: '15px', fontWeight: 700, borderBottom: openSections.score ? '1px solid var(--border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
            <span>{allowPlayerEntry ? 'スコア入力・卓確認' : '卓確認'}</span>
            <span style={{ fontSize: '11px', color: 'var(--mist)', transition: 'transform 0.2s', transform: openSections.score ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </div>
          {openSections.score && Array.from({ length: tournament.num_rounds }, (_, i) => i + 1).map(roundNum => {
            const myTable = getMyTable(roundNum)
            if (!myTable) return (
              <div key={roundNum} style={{ padding: '11px 15px', borderBottom: '1px solid var(--paper)', fontSize: '13.5px', color: 'var(--mist)', ...(scoreAnimate ? { animation: 'slideInDown 0.25s ease both', animationDelay: `${(roundNum - 1) * 60}ms` } : {}) }}>
                {roundNum}回戦 — 卓なし
              </div>
            )
            const results: Result[] = (myTable as any).results ?? []
            const myResult = results.find(r => r.player_id === player.id)
            const isValidated = myTable.is_validated
            const isSubmitted = myTable.is_submitted
            return (
              <div key={roundNum} style={{ padding: '11px 15px', borderBottom: '1px solid var(--paper)', ...(flashTableIds.has(myTable.id) ? { animation: 'flashCyan 1.2s ease' } : scoreAnimate ? { animation: 'slideInDown 0.25s ease both', animationDelay: `${(roundNum - 1) * 60}ms` } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {roundNum}回戦 — 卓{myTable.table_number}
                    {!noSeat && (
                      <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--mist)' }}>
                        ({SEAT_LABELS[myResult?.seat_index ?? 0]}家)
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '10.5px', padding: '2px 7px', borderRadius: '9px', fontFamily: 'monospace',
                    background: isValidated
                      ? 'linear-gradient(90deg, var(--cyan-pale) 25%, rgba(0,240,255,0.38) 50%, var(--cyan-pale) 75%)'
                      : isSubmitted ? 'rgba(0,255,170,0.12)' : 'var(--gold-pale)',
                    backgroundSize: isValidated ? '200% auto' : 'auto',
                    animation: isValidated ? 'shimmer 2.5s linear infinite' : 'none',
                    color: isValidated ? 'var(--cyan-deep)' : isSubmitted ? '#00ffaa' : 'var(--gold-dark)',
                  }}>{isValidated ? '確定済み' : isSubmitted ? '送信済み' : '入力中'}</span>
                </div>
                {isValidated ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0 10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'monospace' }}>{Math.floor(myResult?.rank ?? 0)}位</span>
                      <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'monospace' }}>素点 {((myResult?.score ?? 0) / 100).toLocaleString()}00</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: 700, color: (myResult?.point ?? 0) >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                        {formatPoint(myResult?.point ?? 0)}
                      </span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--paper)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--cyan-deep)' }}>卓{myTable.table_number} 全員の結果</div>
                      </div>
                      {sortResults(results).map((r, ri) => {
                        const rPlayer = localPlayers.find(p => p.id === r.player_id)
                        const isMe = r.player_id === player.id
                        const sc2 = noSeat ? NUM_COLOR : SEAT_COLORS[r.seat_index]
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid var(--paper)' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: noSeat ? '4px' : '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: noSeat ? '10px' : '9px', fontWeight: 700, fontFamily: noSeat ? 'monospace' : 'serif', background: sc2.bg, color: sc2.color, flexShrink: 0 }}>
                              {noSeat ? `${ri + 1}` : SEAT_LABELS[r.seat_index]}
                            </div>
                            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: isMe ? 'var(--cyan-deep)' : 'var(--ink)' }}>
                              {rPlayer?.name}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--mist)', fontFamily: 'monospace', minWidth: '38px', textAlign: 'right' }}>{(r.score / 100).toLocaleString()}00</span>
                            <span style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'monospace' }}>{Math.floor(r.rank)}位</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '12.5px', fontWeight: 600, minWidth: '52px', textAlign: 'right', color: r.point >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                              {formatPoint(r.point)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : isSubmitted ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0 10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'monospace' }}>{Math.floor(myResult?.rank ?? 0)}位</span>
                      <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'monospace' }}>素点 {((myResult?.score ?? 0) / 100).toLocaleString()}00</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: 700, color: (myResult?.point ?? 0) >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                        {formatPoint(myResult?.point ?? 0)}
                      </span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--paper)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#00ffaa' }}>卓{myTable.table_number} 送信済み（暫定）</div>
                        {allowPlayerEntry && (
                          <button onClick={() => handleRevertSubmit(myTable)} style={{
                            padding: '3px 10px', fontSize: '10.5px', fontWeight: 600,
                            background: 'rgba(0,240,255,0.06)', color: 'var(--mist)',
                            border: '1px solid rgba(0,240,255,0.12)', borderRadius: '6px',
                            cursor: 'pointer',
                          }}>修正する</button>
                        )}
                      </div>
                      {sortResults(results).map((r, ri) => {
                        const rPlayer = localPlayers.find(p => p.id === r.player_id)
                        const isMe = r.player_id === player.id
                        const sc2 = noSeat ? NUM_COLOR : SEAT_COLORS[r.seat_index]
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid var(--paper)' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: noSeat ? '4px' : '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: noSeat ? '10px' : '9px', fontWeight: 700, fontFamily: noSeat ? 'monospace' : 'serif', background: sc2.bg, color: sc2.color, flexShrink: 0 }}>
                              {noSeat ? `${ri + 1}` : SEAT_LABELS[r.seat_index]}
                            </div>
                            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: isMe ? 'var(--cyan-deep)' : 'var(--ink)' }}>
                              {rPlayer?.name}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--mist)', fontFamily: 'monospace', minWidth: '38px', textAlign: 'right' }}>{(r.score / 100).toLocaleString()}00</span>
                            <span style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'monospace' }}>{Math.floor(r.rank)}位</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '12.5px', fontWeight: 600, minWidth: '52px', textAlign: 'right', color: r.point >= 0 ? 'var(--cyan-deep)' : 'var(--red)' }}>
                              {formatPoint(r.point)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : allowPlayerEntry ? (
                  <div>
                    <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--cyan-deep)', marginBottom: '8px' }}>
                      卓{myTable.table_number} スコア入力（全員分）
                    </div>
                    {sortResults(results).map((r, ri) => {
                      const rPlayer = localPlayers.find(p => p.id === r.player_id)
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
                              flex: 1, fontSize: '13px', fontWeight: 600,
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
                            width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0,
                            border: `1.5px solid ${sc.negative ? 'rgba(239,68,68,0.3)' : 'var(--border-md)'}`,
                            background: sc.negative ? 'var(--red-pale)' : 'var(--paper)',
                            color: sc.negative ? 'var(--red)' : 'var(--mist)',
                            fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>▲</button>
                          <input
                            type="number"
                            value={sc.value}
                            onChange={e => setScores(s => ({ ...s, [r.id]: { ...sc, value: e.target.value } }))}
                            placeholder={(tournament.config.startingPoints / 100).toString()}
                            style={{
                              width: '80px', padding: '6px 8px',
                              border: '1.5px solid var(--border-md)', borderRadius: '6px',
                              fontSize: '13px', fontWeight: 600, textAlign: 'right',
                              fontFamily: 'monospace', background: 'var(--paper)', color: '#fff', outline: 'none',
                            }}
                          />
                          <span style={{ fontSize: '10.5px', color: 'var(--mist)', fontFamily: 'monospace', flexShrink: 0 }}>00</span>
                        </div>
                      )
                    })}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button onClick={() => submitScores(myTable)} disabled={submitting === myTable.id} style={{
                        flex: 1, padding: '8px',
                        background: submitting === myTable.id ? 'var(--mist)' : 'linear-gradient(135deg, #00c8d4, #00a0aa)',
                        color: '#fff', border: 'none', borderRadius: '7px',
                        fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
                      }}>{submitting === myTable.id ? '送信中...' : 'スコアを送信'}</button>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11.5px', color: 'var(--mist)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={extraSticks[myTable.id] ?? false} onChange={e => setExtraSticks(s => ({ ...s, [myTable.id]: e.target.checked }))} />
                      卓外点棒あり（合計チェックをスキップ）
                    </label>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--mist)', marginBottom: '8px' }}>
                      卓{myTable.table_number} メンバー
                    </div>
                    {sortResults(results).map((r, ri) => {
                      const rPlayer = localPlayers.find(p => p.id === r.player_id)
                      const isMe = r.player_id === player.id
                      const sc2 = noSeat ? NUM_COLOR : SEAT_COLORS[r.seat_index]
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid var(--paper)' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: noSeat ? '4px' : '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: noSeat ? '10px' : '9px', fontWeight: 700, fontFamily: noSeat ? 'monospace' : 'serif', background: sc2.bg, color: sc2.color, flexShrink: 0 }}>
                            {noSeat ? `${ri + 1}` : SEAT_LABELS[r.seat_index]}
                          </div>
                          <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: isMe ? 'var(--cyan-deep)' : 'var(--ink)' }}>
                            {rPlayer?.name}
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--paper)', borderRadius: '7px', fontSize: '12px', color: 'var(--mist)', textAlign: 'center' }}>
                      スコアは管理者が入力します
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 得点調整 (accordion, default closed) */}
        <div style={{ background: 'rgba(15,21,40,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(0,240,255,0.10)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          <div onClick={() => toggleSection('adjustment')} style={{ padding: '11px 15px', fontFamily: 'serif', fontSize: '15px', fontWeight: 700, borderBottom: openSections.adjustment ? '1px solid var(--border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
            <span>得点調整</span>
            <span style={{ fontSize: '11px', color: 'var(--mist)', transition: 'transform 0.2s', transform: openSections.adjustment ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </div>
          {openSections.adjustment && (
            <div style={{ padding: '12px 15px' }}>
              <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '8px' }}>
                チョンボ等のペナルティや調整ポイントを入力してください
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => setAdjustmentNeg(n => !n)} style={{
                  width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                  border: `1.5px solid ${adjustmentNeg ? 'rgba(239,68,68,0.3)' : 'var(--border-md)'}`,
                  background: adjustmentNeg ? 'var(--red-pale)' : 'var(--paper)',
                  color: adjustmentNeg ? 'var(--red)' : 'var(--cyan-deep)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
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
                    fontSize: '14px', fontWeight: 600, textAlign: 'right',
                    fontFamily: 'monospace', background: 'var(--paper)', color: '#fff', outline: 'none',
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'monospace', flexShrink: 0 }}>pt</span>
                <button
                  onClick={async () => {
                    setSavingAdjustment(true)
                    const val = parseFloat(adjustmentInput) || 0
                    const bonus = adjustmentNeg ? -Math.abs(val) : Math.abs(val)
                    await supabase.from('players').update({ bonus }).eq('id', player.id)
                    setLocalPlayer(prev => ({ ...prev, bonus }))
                    setLocalPlayers(prev => prev.map(p => p.id === player.id ? { ...p, bonus } : p))
                    setSavingAdjustment(false)
                  }}
                  disabled={savingAdjustment}
                  style={{
                    padding: '6px 14px', flexShrink: 0,
                    background: savingAdjustment ? 'var(--mist)' : 'linear-gradient(135deg, #00c8d4, #00a0aa)',
                    color: '#fff', border: 'none', borderRadius: '7px',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >{savingAdjustment ? '保存中...' : '保存'}</button>
              </div>
              {(localPlayer.bonus ?? 0) !== 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--mist)' }}>
                  現在の調整: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: localPlayer.bonus < 0 ? 'var(--red)' : 'var(--cyan-deep)' }}>
                    {formatPoint(localPlayer.bonus)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 全体成績 (accordion, default closed) */}
        <div style={{ background: 'rgba(15,21,40,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(0,240,255,0.10)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          <div onClick={() => toggleSection('standings')} style={{ padding: '11px 15px', fontFamily: 'serif', fontSize: '15px', fontWeight: 700, borderBottom: openSections.standings ? '1px solid var(--border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
            <span>全体成績</span>
            <span style={{ fontSize: '11px', color: 'var(--mist)', transition: 'transform 0.2s', transform: openSections.standings ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </div>
          {openSections.standings && standings.map((s, i) => {
            const isMe = s.player.id === player.id
            const barWidth = Math.abs(s.total) / standingsMaxAbs * 100
            const anim = standingsAnimate
            return (
              <div key={s.player.id} style={{
                padding: '8px 15px', borderBottom: '1px solid var(--paper)',
                background: isMe ? 'var(--cyan-pale)' : 'transparent',
                position: 'relative', overflow: 'hidden',
                ...(anim ? {
                  animation: isMe
                    ? `popIn 0.3s ease ${i * 50}ms both, mePulse 0.9s ease ${i * 50 + 400}ms both`
                    : `slideInDown 0.3s ease ${i * 50}ms both`,
                } : {}),
              }}>
                {/* score bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${barWidth}%`,
                  background: s.total >= 0
                    ? 'linear-gradient(90deg, rgba(0,240,255,0.08), rgba(0,240,255,0.15))'
                    : 'linear-gradient(90deg, rgba(239,68,68,0.06), rgba(239,68,68,0.12))',
                  transformOrigin: 'left',
                  ...(anim ? { animation: `standingsBarGrow 0.6s ease ${i * 50 + 200}ms both` } : {}),
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                  {i < 3 ? (
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px',
                      background: i === 0 ? 'linear-gradient(135deg, #D4AF37, #F5D060)' : i === 1 ? 'linear-gradient(135deg, #8C9298, #C0C8D0)' : 'linear-gradient(135deg, #A0522D, #CD8032)',
                      color: i === 0 ? '#2a2000' : i === 1 ? '#1a1a2a' : '#2a1500',
                      fontWeight: 800, fontFamily: 'monospace', flexShrink: 0,
                      boxShadow: i === 0 ? '0 0 8px rgba(212,175,55,0.4)' : 'none',
                      animation: anim && i === 0 ? `medalPulse 2s ease-in-out 600ms infinite` : 'none',
                    }}>{i + 1}</div>
                  ) : (
                    <div style={{
                      fontFamily: 'monospace', fontSize: '12px', fontWeight: 400,
                      color: 'var(--mist)', width: '22px', textAlign: 'center', flexShrink: 0,
                    }}>{i + 1}</div>
                  )}
                  <div style={{ flex: 1, fontSize: '13.5px', fontWeight: 600, color: isMe ? 'var(--cyan-deep)' : 'var(--ink)' }}>
                    {s.player.name}{isMe ? '（自分）' : ''}
                  </div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: '13.5px', fontWeight: 600,
                    color: s.total >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                    ...(anim ? { animation: `pointSlideIn 0.4s ease ${i * 50 + 150}ms both` } : {}),
                  }}>
                    {formatPoint(s.total)}
                  </div>
                </div>
                {s.roundPoints.some(pt => pt !== null) && (
                  <div style={{
                    marginTop: '4px', paddingLeft: '30px', overflow: 'hidden',
                    ...(anim ? { animation: `detailFadeIn 0.5s ease ${i * 50 + 300}ms both` } : {}),
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${tournament.num_rounds}, minmax(0, 1fr))`,
                      gap: '3px',
                    }}>
                      {s.roundPoints.map((pt, ri) => (
                        <span key={ri} style={{
                          fontSize: '10px', fontFamily: 'monospace', padding: '2px 3px',
                          borderRadius: '4px', background: 'rgba(0,240,255,0.06)',
                          color: pt === null ? 'var(--mist)' : pt >= 0 ? 'var(--cyan-deep)' : 'var(--red)',
                          textAlign: 'center', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden',
                          ...(anim ? { animation: `popIn 0.25s ease ${i * 50 + 350 + ri * 80}ms both` } : {}),
                        }}>
                          R{ri + 1}:{pt !== null ? formatPoint(pt) : '—'}
                        </span>
                      ))}
                    </div>
                    {(s.player.bonus ?? 0) !== 0 && (
                      <span style={{
                        display: 'inline-block', marginTop: '2px',
                        fontSize: '10px', fontFamily: 'monospace', padding: '2px 5px',
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

        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--mist)', padding: '8px 0 24px', fontFamily: 'monospace' }}>
          Yitia — {tournament.name}
        </div>
      </div>
    </div>
  )
}
