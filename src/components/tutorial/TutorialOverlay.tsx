'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/* ── Types ── */
export interface TutorialStep {
  target: string          // CSS selector e.g. [data-tutorial="xxx"]
  content: string         // tooltip text
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

interface TutorialCtx {
  isActive: boolean
  start: (steps: TutorialStep[], pageKey: string) => void
}

const Ctx = createContext<TutorialCtx>({ isActive: false, start: () => {} })
export const useTutorial = () => useContext(Ctx)

/* ── localStorage helpers ── */
const seenKey = (k: string) => `yitia-tutorial-seen-${k}`
export const hasSeen = (k: string) => {
  try { return localStorage.getItem(seenKey(k)) === '1' } catch { return false }
}
const markSeen = (k: string) => {
  try { localStorage.setItem(seenKey(k), '1') } catch {}
}

/* ── Provider ── */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [steps, setSteps] = useState<TutorialStep[]>([])
  const [idx, setIdx] = useState(0)
  const [pageKey, setPageKey] = useState('')

  const start = useCallback((s: TutorialStep[], pk: string) => {
    if (s.length === 0) return
    setSteps(s)
    setIdx(0)
    setPageKey(pk)
    setActive(true)
  }, [])

  const end = useCallback(() => {
    setActive(false)
    if (pageKey) markSeen(pageKey)
  }, [pageKey])

  const next = useCallback(() => {
    setIdx(i => {
      if (i + 1 >= steps.length) { end(); return i }
      return i + 1
    })
  }, [steps.length, end])

  const prev = useCallback(() => { setIdx(i => Math.max(0, i - 1)) }, [])

  return (
    <Ctx.Provider value={{ isActive: active, start }}>
      {children}
      {active && <Overlay steps={steps} idx={idx} next={next} prev={prev} skip={end} />}
    </Ctx.Provider>
  )
}

/* ── Overlay ── */
interface Rect { top: number; left: number; width: number; height: number }

function Overlay({ steps, idx, next, prev, skip }: {
  steps: TutorialStep[]; idx: number; next: () => void; prev: () => void; skip: () => void
}) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [tipPos, setTipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const tipRef = useRef<HTMLDivElement>(null)
  const step = steps[idx]
  const isLast = idx === steps.length - 1
  const pad = 6

  // measure target element
  const measure = useCallback(() => {
    if (!step) return
    const el = document.querySelector(step.target) as HTMLElement | null
    if (!el) { next(); return }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        setRect({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 })
      })
    })
  }, [step, next])

  useEffect(() => { measure() }, [measure])

  // recalc on resize/scroll
  useEffect(() => {
    const h = () => measure()
    window.addEventListener('resize', h)
    window.addEventListener('scroll', h, true)
    return () => { window.removeEventListener('resize', h); window.removeEventListener('scroll', h, true) }
  }, [measure])

  // position tooltip
  useEffect(() => {
    if (!rect || !tipRef.current) return
    const tip = tipRef.current.getBoundingClientRect()
    const placement = step?.placement ?? 'bottom'
    const vw = window.innerWidth
    const vh = window.innerHeight
    let t = 0, l = 0
    const gap = 12

    if (placement === 'bottom') {
      t = rect.top + rect.height + gap
      l = rect.left + rect.width / 2 - tip.width / 2
    } else if (placement === 'top') {
      t = rect.top - tip.height - gap
      l = rect.left + rect.width / 2 - tip.width / 2
    } else if (placement === 'right') {
      t = rect.top + rect.height / 2 - tip.height / 2
      l = rect.left + rect.width + gap
    } else {
      t = rect.top + rect.height / 2 - tip.height / 2
      l = rect.left - tip.width - gap
    }

    // clamp within viewport
    l = Math.max(12, Math.min(l, vw - tip.width - 12))
    t = Math.max(12, Math.min(t, vh - tip.height - 12))
    setTipPos({ top: t, left: l })
  }, [rect, step?.placement, idx])

  // close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') skip() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [skip])

  if (!step || !rect) return null

  const { top: rT, left: rL, width: rW, height: rH } = rect

  const clipPath = `polygon(
    0 0, 0 100%, 100% 100%, 100% 0, 0 0,
    ${rL}px ${rT}px, ${rL}px ${rT + rH}px, ${rL + rW}px ${rT + rH}px, ${rL + rW}px ${rT}px, ${rL}px ${rT}px
  )`

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
      {/* dark mask with spotlight */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,14,26,0.7)',
          clipPath,
          transition: 'clip-path 0.3s ease',
        }}
        onClick={skip}
      />
      {/* spotlight border glow */}
      <div style={{
        position: 'fixed',
        top: rT, left: rL, width: rW, height: rH,
        borderRadius: '8px',
        boxShadow: '0 0 0 2px var(--cyan-deep), 0 0 20px rgba(0,240,255,0.15)',
        pointerEvents: 'none',
        transition: 'all 0.3s ease',
      }} />

      {/* tooltip */}
      <div ref={tipRef} style={{
        position: 'fixed',
        top: tipPos.top, left: tipPos.left,
        background: 'var(--surface)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '16px 18px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        maxWidth: '300px',
        minWidth: '200px',
        zIndex: 10001,
        transition: 'top 0.3s ease, left 0.3s ease',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.6, marginBottom: '14px' }}>
          {step.content}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{idx + 1} / {steps.length}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={skip} style={linkBtn}>スキップ</button>
            {idx > 0 && <button onClick={prev} style={outlineBtn}>前へ</button>}
            <button onClick={next} style={primaryBtn}>{isLast ? '完了' : '次へ'}</button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

/* ── HelpButton (dropdown menu) ── */
export function HelpButton({ steps, pageKey }: { steps: TutorialStep[]; pageKey: string }) {
  const { start, isActive } = useTutorial()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // close on outside click
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        title="ヘルプ"
        onClick={() => setOpen(o => !o)}
        disabled={isActive}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan)'; e.currentTarget.style.background = 'var(--hover-bg)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--mist)'; e.currentTarget.style.background = 'transparent' }}
        style={{
          width: '32px', height: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'var(--mist)',
          transition: 'color 0.15s, background 0.15s',
          fontSize: '15px', fontWeight: 700,
        }}
      >
        ?
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, minWidth: '140px',
          background: 'var(--surface)', border: '1px solid var(--card-border)',
          borderRadius: '10px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
          padding: '4px', zIndex: 9000,
        }}>
          <button
            onClick={() => { setOpen(false); start(steps, pageKey) }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '8px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', color: 'var(--ink)', fontSize: '13px', fontWeight: 500,
              textAlign: 'left',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            使い方
          </button>
        </div>
      )}
    </div>
  )
}

/* ── button styles ── */
const primaryBtn: React.CSSProperties = {
  padding: '5px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
  fontSize: '12px', fontWeight: 600,
  background: 'var(--cyan-deep)', color: '#fff',
  transition: 'opacity 0.15s',
}

const outlineBtn: React.CSSProperties = {
  padding: '5px 14px', borderRadius: '7px', cursor: 'pointer',
  fontSize: '12px', fontWeight: 600,
  background: 'transparent', color: 'var(--cyan-deep)',
  border: '1.5px solid var(--cyan-deep)',
  transition: 'opacity 0.15s',
}

const linkBtn: React.CSSProperties = {
  padding: '5px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer',
  fontSize: '11px', fontWeight: 500,
  background: 'transparent', color: 'var(--mist)',
  transition: 'color 0.15s',
}
