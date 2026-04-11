'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcStandings, formatPoint } from '@/lib/mahjong/calculator'
import type { Tournament, Player, Table } from '@/types'
import ProBadge from '@/components/ui/ProBadge'

interface Props {
  tournament: Tournament
  players: Player[]
  tables: Table[]
}

const SEAT_LABELS = ['東', '南', '西', '北']
const SEAT_COLORS = ['#e86280', '#62c8e8', '#8BE88B', '#c49be8']
const CHART_COLORS = [
  '#D4AF37', '#62c8e8', '#e86280', '#8BE88B', '#c49be8',
  '#e8a84c', '#4ce8c4', '#e8e84c', '#e87c4c', '#8888e8',
  '#e84ca0', '#4ca0e8', '#b8e84c', '#e84c4c', '#4ce8e8',
  '#c888d8', '#d8c870', '#70d8a0', '#d87088', '#88b0d8',
]

type View = 'schedule' | 'standings' | 'chart'
const VIEW_DURATION = 30000
const TRANSITION_DURATION = 800

export default function MonitorClient({ tournament, players: initialPlayers, tables: initialTables }: Props) {
  const supabase = createClient()
  const [players] = useState(initialPlayers)
  const [tables, setTables] = useState(initialTables)
  const [currentView, setCurrentView] = useState<View>('schedule')
  const [phase, setPhase] = useState<'in' | 'out' | 'idle'>('in') // 'in' = entering, 'out' = exiting
  const [flash, setFlash] = useState<{ tableId: string; tableName: string } | null>(null)
  const viewOrder: View[] = ['schedule', 'standings', 'chart']
  const tablesRef = useRef(initialTables)

  useEffect(() => { tablesRef.current = tables }, [tables])

  const activeRound = (() => {
    const validated = tables.filter(t => t.is_validated).map(t => t.round_number)
    const submitted = tables.filter(t => t.is_submitted).map(t => t.round_number)
    const maxValidated = validated.length > 0 ? Math.max(...validated) : 0
    const maxSubmitted = submitted.length > 0 ? Math.max(...submitted) : 0
    const latest = Math.max(maxValidated, maxSubmitted, 1)
    const currentRoundTables = tables.filter(t => t.round_number === latest)
    if (currentRoundTables.length > 0 && currentRoundTables.every(t => t.is_validated) && latest < tournament.num_rounds) {
      return latest + 1
    }
    return latest
  })()

  const roundTables = tables.filter(t => t.round_number === activeRound)

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: newTables } = await supabase
        .from('tables')
        .select('*, results(*, player:players(*))')
        .eq('tournament_id', tournament.id)
        .order('round_number')
        .order('table_number')

      if (newTables) {
        for (const nt of newTables) {
          const old = tablesRef.current.find(t => t.id === nt.id)
          if (old && !old.is_submitted && nt.is_submitted) {
            setFlash({ tableId: nt.id, tableName: `${nt.round_number}R - ${nt.table_number}卓` })
            setTimeout(() => setFlash(null), 5000)
          }
        }
        setTables(newTables)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [tournament.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // After entering animation, go idle
    if (phase === 'in') {
      const t = setTimeout(() => setPhase('idle'), TRANSITION_DURATION)
      return () => clearTimeout(t)
    }
  }, [phase])

  useEffect(() => {
    const interval = setInterval(() => {
      // Start exit animation
      setPhase('out')
      // Switch view after exit completes
      setTimeout(() => {
        setCurrentView(prev => {
          const idx = viewOrder.indexOf(prev)
          return viewOrder[(idx + 1) % viewOrder.length]
        })
        setPhase('in')
      }, TRANSITION_DURATION)
    }, VIEW_DURATION)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const standings = calcStandings(players, tables.filter(t => t.is_validated), tournament.num_rounds)

  const flashOverlay = flash && (
    <div style={{
      position: 'fixed', top: '24px', right: '24px', zIndex: 1000,
      background: 'var(--mon-flash-bg)',
      border: '2px solid var(--mon-accent-mid)',
      borderRadius: '16px', padding: '20px 32px',
      backdropFilter: 'blur(20px)',
      animation: 'monitorFlashIn 0.5s ease both',
      boxShadow: '0 8px 40px var(--mon-accent-glow)',
    }}>
      <div style={{ fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.2em', color: 'var(--mon-accent-mid)', marginBottom: '4px' }}>SCORE SUBMITTED</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--mon-fg)' }}>{flash.tableName}</div>
    </div>
  )

  return (
    <div className="monitor-root" style={{
      position: 'fixed', inset: 0,
      background: 'var(--mon-bg)',
      color: 'var(--mon-fg)', overflow: 'hidden',
      fontFamily: "var(--font-en, 'IBM Plex Sans'), var(--font-jp, 'M PLUS 1p'), sans-serif",
    }}>
      <style>{`
        .monitor-root {
          --mon-bg: var(--paper);
          --mon-fg: var(--ink);
          --mon-fg-dim: var(--mist);
          --mon-fg-dimmer: var(--border-md);
          --mon-card-bg: var(--card-bg);
          --mon-card-border: var(--card-border);
          --mon-border: var(--border);
          --mon-accent: var(--cyan-deep);
          --mon-accent-mid: var(--cyan);
          --mon-accent-glow: var(--focus-shadow);
          --mon-accent-pale: var(--cyan-pale);
          --mon-red: var(--red);
          --mon-gold: #D4AF37;
          --mon-flash-bg: var(--cyan-pale);
          --mon-positive: var(--cyan-deep);
          --mon-negative: var(--red);
          --mon-bar-positive: linear-gradient(270deg, rgba(0,180,200,0.15), transparent);
          --mon-bar-negative: linear-gradient(270deg, rgba(239,68,68,0.10), transparent);
          --mon-grid-line: var(--border);
          --mon-grid-zero: var(--border-md);
          --mon-shimmer: linear-gradient(90deg, var(--ink) 20%, var(--cyan-deep) 40%, #D4AF37 60%, var(--ink) 80%);
        }
        @keyframes monitorFlashIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes monitorSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes monitorSlideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes monitorFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes monitorBarGrow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes monitorRankPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes monitorTableFlash {
          0% { border-color: var(--mon-accent-mid); box-shadow: 0 0 30px var(--mon-accent-glow); }
          50% { border-color: var(--mon-border); box-shadow: 0 0 10px transparent; }
          100% { border-color: var(--mon-accent-mid); box-shadow: 0 0 30px var(--mon-accent-glow); }
        }
        @keyframes monitorTitleShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes monitorCellReveal {
          from { opacity: 0; transform: translateY(-4px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes monitorMedalPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @keyframes monitorTableReveal {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (max-width: 600px) {
          .monitor-header { flex-wrap: wrap; padding: 10px 12px !important; gap: 8px; }
          .monitor-header-left { order: 1; flex: 1; min-width: 0; }
          .monitor-header-timer { order: 3; width: 100%; justify-content: center; }
          .monitor-header-views { order: 2; }
          .monitor-timer-digit { font-size: 32px !important; }
          .monitor-timer-colon { font-size: 24px !important; }
          .monitor-timer-ring { width: 36px !important; height: 36px !important; }
          .monitor-content { padding: 12px !important; }
          .monitor-schedule-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .monitor-standings-title, .monitor-chart-title { font-size: 16px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="monitor-header" style={{
        padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid var(--mon-border)`,
        position: 'relative', zIndex: 10,
      }}>
        <div className="monitor-header-left">
          <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--mon-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tournament.name}</div>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--mon-fg-dim)', letterSpacing: '0.1em' }}>
            {tournament.held_on ?? ''} / {tournament.num_rounds} ROUNDS
          </div>
        </div>

        {/* Countdown Timer */}
        <CountdownTimer />

        <div className="monitor-header-views" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {viewOrder.map(v => (
            <button key={v} onClick={() => { setPhase('out'); setTimeout(() => { setCurrentView(v); setPhase('in') }, TRANSITION_DURATION * 0.5) }}
              title={v === 'schedule' ? `R${activeRound} 卓組` : v === 'standings' ? '総合成績' : 'グラフ'}
              style={{
                padding: '8px', borderRadius: '6px',
                background: currentView === v ? 'var(--mon-accent-pale)' : 'transparent',
                border: currentView === v ? '1px solid var(--mon-accent-mid)' : `1px solid var(--mon-border)`,
                color: currentView === v ? 'var(--mon-accent)' : 'var(--mon-fg-dim)',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {v === 'schedule' ? (
                /* Grid/Table icon for 卓組 */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
                </svg>
              ) : v === 'standings' ? (
                /* Trophy/Medal icon for 総合成績 */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
              ) : (
                /* Chart/Line icon for グラフ */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="monitor-content" style={{
        flex: 1, height: 'calc(100vh - 72px)', overflow: 'auto',
        padding: '24px 32px',
        opacity: phase === 'out' ? 0 : 1,
        transform: phase === 'out' ? 'translateY(-16px) scale(0.98)' : phase === 'in' ? 'translateY(0) scale(1)' : 'none',
        transition: phase === 'out'
          ? `opacity ${TRANSITION_DURATION * 0.8}ms ease-in, transform ${TRANSITION_DURATION * 0.8}ms ease-in`
          : `opacity ${TRANSITION_DURATION * 0.6}ms ease-out, transform ${TRANSITION_DURATION * 0.6}ms ease-out`,
      }}>
        {currentView === 'schedule' && (
          <ScheduleView tables={roundTables} activeRound={activeRound} flashTableId={flash?.tableId ?? null} config={tournament.config} />
        )}
        {currentView === 'standings' && (
          <StandingsView standings={standings} numRounds={tournament.num_rounds} config={tournament.config} />
        )}
        {currentView === 'chart' && (
          <ChartView standings={standings} numRounds={tournament.num_rounds} />
        )}
      </div>

      {flashOverlay}
      <ProgressBar duration={VIEW_DURATION} currentView={currentView} />
    </div>
  )
}

/* ─── Countdown Timer ─── */
function CountdownTimer() {
  const [totalSeconds, setTotalSeconds] = useState(0) // total duration
  const [remaining, setRemaining] = useState(0) // seconds left
  const [running, setRunning] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [inputHour, setInputHour] = useState(1)
  const [inputMin, setInputMin] = useState(0)
  const [inputSec, setInputSec] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  // Restore timer from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('monitor-timer')
      if (saved) {
        const { totalSeconds: ts, endAt, paused, pausedRemaining } = JSON.parse(saved)
        if (ts > 0) {
          setTotalSeconds(ts)
          if (paused && pausedRemaining > 0) {
            setRemaining(pausedRemaining)
            setRunning(false)
          } else if (endAt) {
            const left = Math.round((endAt - Date.now()) / 1000)
            if (left > 0) {
              setRemaining(left)
              setRunning(true)
            } else {
              setRemaining(0)
              setRunning(false)
            }
          }
        }
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Persist timer state to localStorage
  useEffect(() => {
    if (!hydrated) return
    if (totalSeconds <= 0) {
      localStorage.removeItem('monitor-timer')
      return
    }
    const data = running
      ? { totalSeconds, endAt: Date.now() + remaining * 1000, paused: false, pausedRemaining: 0 }
      : { totalSeconds, endAt: null, paused: true, pausedRemaining: remaining }
    localStorage.setItem('monitor-timer', JSON.stringify(data))
  }, [hydrated, totalSeconds, running, remaining])

  useEffect(() => {
    if (!running || remaining <= 0) return
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { setRunning(false); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [running, remaining])

  function startTimer() {
    const total = inputHour * 3600 + inputMin * 60 + inputSec
    if (total <= 0) return
    setTotalSeconds(total)
    setRemaining(total)
    setRunning(true)
    setShowSetup(false)
  }

  function resetTimer() {
    setRunning(false)
    setRemaining(0)
    setTotalSeconds(0)
  }

  const h = String(Math.floor(remaining / 3600)).padStart(2, '0')
  const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0')
  const s = String(remaining % 60).padStart(2, '0')
  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0
  const isFinished = totalSeconds > 0 && remaining === 0
  // Color phases: >1/2 = accent, >1/4 = orange, <=1/4 = red
  const timerColor = totalSeconds === 0 ? 'var(--mon-fg)'
    : isFinished ? 'var(--mon-negative)'
    : progress > 0.5 ? 'var(--mon-accent)'
    : progress > 0.25 ? '#e8a84c'
    : 'var(--mon-negative)'

  // Ring dimensions
  const ringSize = 72
  const strokeWidth = 4.5
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <>
      <div className="monitor-header-timer"
        onClick={() => { if (!running) setShowSetup(true) }}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          cursor: running ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Circular progress ring */}
        {totalSeconds > 0 && (
          <svg className="monitor-timer-ring" width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            {/* Background ring */}
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--mon-border)" strokeWidth={strokeWidth} />
            {/* Progress ring */}
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none"
              stroke={timerColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
            />
          </svg>
        )}

        {/* Time display */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '2px',
          fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.02em',
          color: timerColor,
          transition: 'color 0.5s',
          animation: isFinished ? 'monitorFadeIn 0.5s ease infinite alternate' : 'none',
        }}>
          {remaining >= 3600 && (
            <>
              <span className="monitor-timer-digit" style={{ fontSize: '48px' }}>{h}</span>
              <span className="monitor-timer-colon" style={{ fontSize: '36px', color: 'var(--mon-fg-dim)' }}>:</span>
            </>
          )}
          <span className="monitor-timer-digit" style={{ fontSize: '48px' }}>{m}</span>
          <span className="monitor-timer-colon" style={{ fontSize: '36px', color: 'var(--mon-fg-dim)', animation: running ? 'monitorFadeIn 1s ease infinite alternate' : 'none' }}>:</span>
          <span className="monitor-timer-digit" style={{ fontSize: '48px' }}>{s}</span>
        </div>

        {/* Pause / Resume / Reset controls */}
        {totalSeconds > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginLeft: '4px' }}>
            {running && (
              <button onClick={e => { e.stopPropagation(); setRunning(false) }}
                style={timerBtnStyle} title="一時停止">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              </button>
            )}
            {!running && remaining > 0 && (
              <button onClick={e => { e.stopPropagation(); setRunning(true) }}
                style={timerBtnStyle} title="再開">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); resetTimer() }}
              style={timerBtnStyle} title="リセット">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            </button>
          </div>
        )}

        {/* Click hint when no timer is set */}
        {totalSeconds === 0 && !showSetup && (
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--mon-fg-dim)', letterSpacing: '0.1em' }}>
            CLICK TO SET TIMER
          </span>
        )}
      </div>

      {/* Setup modal */}
      {showSetup && (
        <div onClick={() => setShowSetup(false)} style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--mon-card-bg)',
            border: '1px solid var(--mon-card-border)',
            borderRadius: '16px', padding: '32px',
            minWidth: '320px', textAlign: 'center',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--mon-fg)', marginBottom: '24px' }}>
              タイマー設定
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
              <SpinnerInput value={inputHour} onChange={setInputHour} min={0} max={23} label="時間" />
              <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--mon-fg-dim)', paddingBottom: '18px' }}>:</span>
              <SpinnerInput value={inputMin} onChange={setInputMin} min={0} max={59} label="分" />
              <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--mon-fg-dim)', paddingBottom: '18px' }}>:</span>
              <SpinnerInput value={inputSec} onChange={setInputSec} min={0} max={59} label="秒" />
            </div>
            {/* Quick presets */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[35, 40, 45, 50, 55, 60].map(mins => {
                const preH = Math.floor(mins / 60)
                const preM = mins % 60
                const active = inputHour === preH && inputMin === preM && inputSec === 0
                return (
                  <button key={mins} onClick={() => { setInputHour(preH); setInputMin(preM); setInputSec(0) }}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace',
                      fontWeight: 600, cursor: 'pointer',
                      background: active ? 'var(--mon-accent-pale)' : 'transparent',
                      border: active ? '1px solid var(--mon-accent-mid)' : '1px solid var(--mon-border)',
                      color: active ? 'var(--mon-accent)' : 'var(--mon-fg-dim)',
                    }}>
                    {mins}分
                  </button>
                )
              })}
            </div>
            <button onClick={startTimer} style={{
              padding: '10px 40px', borderRadius: '8px',
              background: 'var(--mon-accent)', color: '#fff',
              border: 'none', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.05em',
            }}>
              スタート
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function SpinnerInput({ value, onChange, min, max, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; label: string
}) {
  const increment = () => onChange(value >= max ? min : value + 1)
  const decrement = () => onChange(value <= min ? max : value - 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <button onClick={increment} style={spinBtnStyle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
      </button>
      <input type="number" min={min} max={max} value={value}
        onChange={e => {
          const v = +e.target.value
          onChange(Math.min(max, Math.max(min, isNaN(v) ? 0 : v)))
        }}
        style={timerInputStyle} />
      <button onClick={decrement} style={spinBtnStyle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div style={{ fontSize: '10px', color: 'var(--mon-fg-dim)', fontFamily: 'monospace', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

const spinBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--mon-border)',
  borderRadius: '6px', padding: '4px 16px', cursor: 'pointer',
  color: 'var(--mon-fg-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const timerBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--mon-border)',
  borderRadius: '6px', padding: '4px 6px', cursor: 'pointer',
  color: 'var(--mon-fg-dim)', display: 'flex', alignItems: 'center',
}

const timerInputStyle: React.CSSProperties = {
  width: '80px', padding: '10px', textAlign: 'center',
  fontSize: '32px', fontWeight: 700, fontFamily: 'monospace',
  background: 'var(--hover-bg)', border: '1.5px solid var(--mon-border)',
  borderRadius: '10px', color: 'var(--mon-fg)', outline: 'none',
}

/* ─── Schedule View ─── */
function ScheduleView({ tables, activeRound, flashTableId, config }: { tables: Table[]; activeRound: number; flashTableId: string | null; config: import('@/types').RuleConfig }) {
  return (
    <div>
      <div style={{ fontSize: '14px', fontFamily: 'monospace', letterSpacing: '0.15em', color: 'var(--mon-fg-dim)', marginBottom: '20px' }}>
        ROUND {activeRound}
      </div>
      <div className="monitor-schedule-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {tables.map((table, idx) => {
          const isFlashing = table.id === flashTableId
          const results = (table.results ?? []).sort((a, b) => a.seat_index - b.seat_index)
          return (
            <div key={table.id} style={{
              background: 'var(--mon-card-bg)',
              border: isFlashing ? '2px solid var(--mon-accent-mid)' : '1px solid var(--mon-card-border)',
              borderRadius: '14px', padding: '18px',
              animation: isFlashing
                ? 'monitorTableFlash 1.5s ease infinite'
                : `monitorTableReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 150}ms both`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--mon-fg)' }}>{table.table_number}卓</div>
                <div style={{
                  fontSize: '10px', fontFamily: 'monospace', padding: '2px 8px', borderRadius: '4px',
                  background: table.is_validated ? 'rgba(139,232,139,0.15)' : table.is_submitted ? 'var(--mon-accent-pale)' : 'var(--hover-bg)',
                  color: table.is_validated ? '#5cb85c' : table.is_submitted ? 'var(--mon-accent)' : 'var(--mon-fg-dim)',
                }}>
                  {table.is_validated ? 'CONFIRMED' : table.is_submitted ? 'SUBMITTED' : 'PLAYING'}
                </div>
              </div>
              {results.map((r, ri) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '6px 0',
                  borderTop: ri > 0 ? `1px solid var(--mon-border)` : 'none',
                  animation: `monitorFadeIn 0.3s ease ${idx * 150 + ri * 100 + 200}ms both`,
                }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                    background: `${SEAT_COLORS[r.seat_index]}22`,
                    color: SEAT_COLORS[r.seat_index],
                  }}>{SEAT_LABELS[r.seat_index]}</span>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: 'var(--mon-fg)', display: 'inline-flex', alignItems: 'center' }}>
                    {r.player?.name ?? '—'}
                    <ProBadge playerId={r.player_id} config={config} />
                  </span>
                  {table.is_validated && (
                    <>
                      <span style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--mon-fg-dim)' }}>{r.score.toLocaleString()}</span>
                      <span style={{
                        fontSize: '13px', fontFamily: 'monospace', fontWeight: 700,
                        color: r.point > 0 ? 'var(--mon-positive)' : r.point < 0 ? 'var(--mon-negative)' : 'var(--mon-fg-dim)',
                        minWidth: '60px', textAlign: 'right',
                      }}>{formatPoint(r.point)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Animated Counter ─── */
function AnimatedPoint({ value, fontSize = '18px' }: { value: number; fontSize?: string }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    const to = Math.round(value * 10) / 10
    if (from === to) return
    const duration = 400
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round((from + (to - from) * eased) * 10) / 10)
      if (t < 1) requestAnimationFrame(tick)
      else { setDisplay(to); prevRef.current = to }
    }
    requestAnimationFrame(tick)
  }, [value])

  return (
    <strong style={{
      fontFamily: 'monospace', fontSize,
      color: display >= 0 ? 'var(--mon-positive)' : 'var(--mon-negative)',
      transition: 'color 0.3s',
    }}>{formatPoint(display)}</strong>
  )
}

/* ─── Standings View (reveal from bottom) ─── */
function StandingsView({ standings, numRounds, config }: { standings: ReturnType<typeof calcStandings>; numRounds: number; config: import('@/types').RuleConfig }) {
  const maxTotal = Math.max(...standings.map(s => Math.abs(s.total)), 1)
  const [revealedCol, setRevealedCol] = useState(0)
  const total = standings.length

  useEffect(() => { setRevealedCol(0) }, [])

  useEffect(() => {
    if (revealedCol >= numRounds) return
    const t = setTimeout(() => setRevealedCol(c => c + 1), 600)
    return () => clearTimeout(t)
  }, [revealedCol, numRounds])

  return (
    <div>
      <div className="monitor-standings-title" style={{
        fontSize: '22px', fontWeight: 800, marginBottom: '24px',
        backgroundImage: 'var(--mon-shimmer)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'monitorTitleShimmer 4s linear 1s infinite',
      }}>総合成績</div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>NAME</th>
              {Array.from({ length: numRounds }, (_, i) => (
                <th key={i} style={{
                  ...thStyle,
                  opacity: i < revealedCol ? 1 : 0.2,
                  transition: 'opacity 0.3s',
                }}>R{i + 1}</th>
              ))}
              <th style={thStyle}>ADJ</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => {
              const { player, roundPoints, rank, total: totalPt, isTied } = s
              const adj = player.bonus ?? 0
              const barWidth = Math.abs(totalPt) / maxTotal * 100
              // Reveal from bottom: last place appears first
              const revealDelay = (total - 1 - idx) * 120
              return (
                <tr key={player.id} style={{
                  animation: `monitorSlideDown 0.4s ease ${revealDelay}ms both`,
                  background: idx === 0 ? 'rgba(212,175,55,0.06)' : 'transparent',
                }}>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', borderRadius: '50%',
                      fontSize: '12px', fontWeight: 800, fontFamily: 'monospace',
                      ...(rank === 1 ? { background: 'linear-gradient(135deg, #D4AF37, #F5D060)', color: '#2a2000', animation: `monitorMedalPulse 2.5s ease-in-out ${revealDelay + 600}ms infinite` }
                        : rank === 2 ? { background: 'linear-gradient(135deg, #8C9298, #C0C8D0)', color: '#1a1a2a' }
                        : rank === 3 ? { background: 'linear-gradient(135deg, #A0522D, #CD8032)', color: '#2a1500' }
                        : { background: 'var(--hover-bg)', color: 'var(--mon-fg-dim)' }),
                    }}>
                      {rank}{isTied ? <span style={{ fontSize: '8px', marginLeft: '1px' }}>T</span> : null}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, fontSize: '15px', color: 'var(--mon-fg)' }}>
                    {player.name}
                    <ProBadge playerId={player.id} config={config} />
                  </td>
                  {roundPoints.map((pt, i) => (
                    <td key={i} style={{
                      ...tdStyle,
                      fontFamily: 'monospace', fontWeight: 600,
                      color: pt === null ? 'var(--mon-fg-dimmer)' : pt >= 0 ? 'var(--mon-positive)' : 'var(--mon-negative)',
                      opacity: i < revealedCol ? 1 : 0,
                      animation: i < revealedCol ? 'monitorCellReveal 0.3s ease-out both' : 'none',
                    }}>
                      {pt === null ? '—' : formatPoint(pt)}
                    </td>
                  ))}
                  <td style={{
                    ...tdStyle, fontFamily: 'monospace', fontSize: '12px',
                    color: adj < 0 ? 'var(--mon-negative)' : adj > 0 ? 'var(--mon-gold)' : 'var(--mon-fg-dimmer)',
                  }}>
                    {adj !== 0 ? formatPoint(adj) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0,
                      width: `${barWidth}%`,
                      background: totalPt >= 0 ? 'var(--mon-bar-positive)' : 'var(--mon-bar-negative)',
                      transformOrigin: 'right',
                      animation: `monitorBarGrow 0.6s ease ${revealDelay + 200}ms both`,
                    }} />
                    <AnimatedPoint
                      value={roundPoints.slice(0, revealedCol).reduce<number>((sum, p) => sum + (p ?? 0), 0) + adj}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'center',
  fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--mon-fg-dim)',
  borderBottom: '1px solid var(--mon-border)', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'center',
  borderBottom: '1px solid var(--mon-border)', whiteSpace: 'nowrap',
}

/* ─── Chart View ─── */
function ChartView({ standings, numRounds }: {
  standings: ReturnType<typeof calcStandings>; numRounds: number
}) {
  // Only show up to the last round with data
  const displayRounds = (() => {
    let last = 0
    for (const s of standings) {
      for (let r = s.roundPoints.length - 1; r >= 0; r--) {
        if (s.roundPoints[r] !== null) { last = Math.max(last, r + 1); break }
      }
    }
    return Math.max(last, 1)
  })()

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [containerHeight, setContainerHeight] = useState(500)
  const [progress, setProgress] = useState(0)
  const [highlightIdx, setHighlightIdx] = useState(-1) // -1 = no highlight, 0..TOP_N-1 = highlighted rank
  const [blinkCount, setBlinkCount] = useState(0) // 0..5 (3 blink phases)
  // Glow intensity builds up: phase 0=small, 1=medium, 2=full
  const blinkPhase = Math.floor(blinkCount / 2) // 0, 1, 2
  const isBlinkOn = blinkCount % 2 === 0 // even = on, odd = off

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
        setContainerHeight(Math.max(400, window.innerHeight - 200))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setProgress(0)
    setHighlightIdx(-1)
    const duration = displayRounds * 1200
    let raf: number
    let start: number | null = null
    function animate(ts: number) {
      if (start === null) start = ts
      const t = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(eased * displayRounds)
      if (t < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [displayRounds])

  // After chart animation completes, cycle highlight through top players
  const TOP_N = 5
  useEffect(() => {
    if (progress < displayRounds) return
    // Start highlight cycle after a short delay
    const startDelay = setTimeout(() => {
      setHighlightIdx(0)
      setBlinkCount(0)
    }, 500)
    return () => clearTimeout(startDelay)
  }, [progress >= displayRounds]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (highlightIdx < 0) return
    const topCount = Math.min(TOP_N, standings.length)
    // 3 blink cycles (6 states: on-off-on-off-on-off), then next player
    const timer = setTimeout(() => {
      if (blinkCount >= 5) {
        // Move to next player
        setHighlightIdx(prev => (prev + 1) % topCount)
        setBlinkCount(0)
      } else {
        setBlinkCount(prev => prev + 1)
      }
    }, 350) // 350ms per blink state
    return () => clearTimeout(timer)
  }, [highlightIdx, blinkCount, standings.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const cumulativeData = standings.map(entry => {
    const adj = entry.player.bonus ?? 0
    const cumulative: number[] = [adj]
    let sum = adj
    for (let r = 0; r < displayRounds; r++) {
      sum += entry.roundPoints[r] ?? 0
      cumulative.push(Math.round(sum * 10) / 10)
    }
    return { player: entry.player, cumulative, rank: entry.rank }
  })
  const marginLeft = 60
  const marginRight = 140
  const marginTop = 20
  const marginBottom = 40
  const chartWidth = containerWidth - marginLeft - marginRight
  const height = containerHeight
  const chartHeight = height - marginTop - marginBottom

  const allValues = cumulativeData.flatMap(d => d.cumulative)
  const minVal = Math.min(0, ...allValues)
  const maxVal = Math.max(0, ...allValues)
  const range = maxVal - minVal || 1
  const padding = range * 0.1

  const scaleX = (round: number) => marginLeft + (round / numRounds) * chartWidth
  const scaleY = (val: number) => marginTop + chartHeight - ((val - minVal + padding) / (range + padding * 2)) * chartHeight

  const gridColor = 'var(--mon-border)'
  const gridZeroColor = 'var(--mon-fg-dim)'
  const labelColor = 'var(--mon-fg-dim)'
  const labelDimColor = 'var(--mon-fg-dimmer)'

  return (
    <div ref={containerRef}>
      <div className="monitor-chart-title" style={{
        fontSize: '22px', fontWeight: 800, marginBottom: '20px',
        backgroundImage: 'var(--mon-shimmer)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'monitorTitleShimmer 4s linear 1s infinite',
      }}>ポイント推移</div>
      <svg width={containerWidth} height={height} style={{ display: 'block' }}>
        {(() => {
          const rawStep = (maxVal - minVal + padding * 2) / 5
          const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))))
          const niceSteps = [1, 2, 2.5, 5, 10]
          const niceStep = niceSteps.find(s => s * mag >= rawStep)! * mag
          const gridVals = new Set<number>()
          gridVals.add(0)
          for (let v = niceStep; v <= maxVal + padding; v += niceStep) gridVals.add(Math.round(v))
          for (let v = -niceStep; v >= minVal - padding; v -= niceStep) gridVals.add(Math.round(v))
          return Array.from(gridVals).sort((a, b) => a - b).map(val => {
            const y = scaleY(val)
            const isZero = val === 0
            return (
              <g key={`grid-${val}`}>
                <line x1={marginLeft} y1={y} x2={marginLeft + chartWidth} y2={y}
                  stroke={isZero ? gridZeroColor : gridColor}
                  strokeWidth={1} strokeDasharray={isZero ? '4 3' : 'none'} />
                <text x={marginLeft - 8} y={y + 4} fill={isZero ? labelColor : labelDimColor}
                  fontSize="11" fontFamily="monospace" textAnchor="end" fontWeight={isZero ? 700 : 400}>
                  {val}
                </text>
              </g>
            )
          })
        })()}

        {Array.from({ length: numRounds + 1 }, (_, i) => (
          <text key={`rl-${i}`} x={scaleX(i)} y={height - 10}
            fill={i <= progress ? labelColor : labelDimColor}
            fontSize="11" fontFamily="monospace" textAnchor="middle"
            style={{ transition: 'fill 0.5s' }}>
            {i === 0 ? '開始' : `R${i}`}
          </text>
        ))}

        {Array.from({ length: numRounds + 1 }, (_, i) => (
          <line key={`vl-${i}`}
            x1={scaleX(i)} y1={marginTop} x2={scaleX(i)} y2={marginTop + chartHeight}
            stroke={i <= progress ? gridColor : 'transparent'}
            strokeWidth={1} style={{ transition: 'stroke 0.5s' }} />
        ))}

        {[...cumulativeData].reverse().map((data) => {
          const idx = cumulativeData.indexOf(data)
          const color = CHART_COLORS[idx % CHART_COLORS.length]
          const isTop = data.rank <= TOP_N
          const isHighlighted = highlightIdx >= 0 && idx === highlightIdx
          const isAnyHighlighted = highlightIdx >= 0
          const completedRounds = Math.floor(progress)
          const frac = progress - completedRounds
          const points: string[] = []
          for (let r = 0; r <= Math.min(completedRounds, displayRounds); r++) {
            points.push(`${scaleX(r)},${scaleY(data.cumulative[r])}`)
          }
          if (frac > 0 && completedRounds < displayRounds) {
            const prevVal = data.cumulative[completedRounds]
            const nextVal = data.cumulative[completedRounds + 1]
            const interpVal = prevVal + (nextVal - prevVal) * frac
            points.push(`${scaleX(completedRounds + frac)},${scaleY(interpVal)}`)
          }
          const d = points.length > 0 ? `M${points.join('L')}` : ''

          const endRound = Math.min(progress, displayRounds)
          const endComplete = Math.floor(endRound)
          const endFrac = endRound - endComplete
          let endX: number, endY: number
          if (endFrac > 0 && endComplete < displayRounds) {
            const prevVal = data.cumulative[endComplete]
            const nextVal = data.cumulative[endComplete + 1]
            endX = scaleX(endRound)
            endY = scaleY(prevVal + (nextVal - prevVal) * endFrac)
          } else {
            endX = scaleX(endComplete)
            endY = scaleY(data.cumulative[endComplete])
          }

          // Highlight = glow emphasis without dimming others
          const lineWidth = isHighlighted ? 4.5 : isTop ? 3 : 1.5
          const baseOpacity = isTop ? 0.9 : 0.3

          // Progressive glow: phase 0 = subtle, 1 = medium, 2 = full
          const glowOuter = [0.06, 0.1, 0.15][blinkPhase] ?? 0.15
          const glowInner = [0.1, 0.18, 0.3][blinkPhase] ?? 0.3
          const glowWidth = [10, 14, 18][blinkPhase] ?? 18

          return (
            <g key={data.player.id}>
              {/* Glow layers: build volume with each blink */}
              {isHighlighted && isBlinkOn && (
                <>
                  <path d={d} fill="none" stroke={color}
                    strokeWidth={glowWidth} strokeLinecap="round" strokeLinejoin="round"
                    opacity={glowOuter} style={{ filter: 'blur(8px)' }} />
                  <path d={d} fill="none" stroke={color}
                    strokeWidth={glowWidth * 0.5} strokeLinecap="round" strokeLinejoin="round"
                    opacity={glowInner} style={{ filter: 'blur(3px)' }} />
                </>
              )}
              <path d={d} fill="none" stroke={color}
                strokeWidth={lineWidth}
                strokeLinecap="round" strokeLinejoin="round"
                opacity={baseOpacity}
                style={{ transition: 'stroke-width 0.4s' }} />
              {progress > 0 && (
                <circle cx={endX} cy={endY}
                  r={isTop ? 5 : 3}
                  fill={color}
                  opacity={isTop ? 1 : 0.4} />
              )}
              {/* Label: show for highlighted player, or for top N after animation */}
              {((isHighlighted) || (!isAnyHighlighted && isTop && progress >= displayRounds * 0.8)) && (
                <g style={{ opacity: isHighlighted ? 1 : Math.min((progress - displayRounds * 0.8) / (displayRounds * 0.2), 1), transition: 'opacity 0.4s' }}>
                  <text x={endX + 10} y={endY - 6} fill={color}
                    fontSize={isHighlighted ? '15' : '12'} fontFamily="monospace" fontWeight="700"
                    style={{ transition: 'font-size 0.3s' }}>
                    {data.rank}. {data.player.name}
                  </text>
                  <text x={endX + 10} y={endY + 10} fill={color}
                    fontSize={isHighlighted ? '14' : '11'} fontFamily="monospace" fontWeight="600"
                    opacity={0.85} style={{ transition: 'font-size 0.3s' }}>
                    {formatPoint(data.cumulative[Math.min(endComplete, displayRounds)])}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ─── Progress Bar ─── */
function ProgressBar({ duration, currentView }: { duration: number; currentView: View }) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    setProgress(0)
    function tick() {
      const elapsed = Date.now() - startRef.current
      setProgress(Math.min(elapsed / duration, 1))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [currentView, duration])

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: '3px',
      background: 'var(--mon-border)',
    }}>
      <div style={{
        height: '100%', width: `${progress * 100}%`,
        background: `linear-gradient(90deg, var(--mon-accent), var(--mon-gold))`,
        transition: 'width 0.1s linear',
      }} />
    </div>
  )
}
