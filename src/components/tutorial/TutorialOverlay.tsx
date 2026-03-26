'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/* ── Types ── */
export interface TutorialStep {
  target: string          // kept for backward compat (not used in card mode)
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  title?: string
  icon?: ReactNode
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
      {active && <CardOverlay steps={steps} idx={idx} next={next} prev={prev} skip={end} />}
    </Ctx.Provider>
  )
}

/* ── Card Overlay (slideshow) ── */
function CardOverlay({ steps, idx, next, prev, skip }: {
  steps: TutorialStep[]; idx: number; next: () => void; prev: () => void; skip: () => void
}) {
  const step = steps[idx]
  const isLast = idx === steps.length - 1
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  // close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') skip() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [skip])

  // prevent body scroll
  useEffect(() => {
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX
    const dx = touchStartX.current - touchEndX.current
    if (Math.abs(dx) > 50) {
      if (dx > 0) next()       // swipe left → next
      else if (idx > 0) prev() // swipe right → prev
    }
  }

  if (!step) return null

  const overlay = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,14,26,0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) skip() }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '360px',
        background: 'var(--surface)',
        border: '1px solid var(--card-border)',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        animation: 'tutorialFadeIn 0.25s ease',
      }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '4px', padding: '16px 20px 0' }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: i <= idx ? 'var(--cyan-deep)' : 'var(--hover-bg)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Icon area */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '28px 20px 16px',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'var(--hover-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {step.icon || (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            )}
          </div>
        </div>

        {/* Title */}
        {step.title && (
          <div style={{
            textAlign: 'center', padding: '0 24px',
            fontSize: '17px', fontWeight: 700, color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}>
            {step.title}
          </div>
        )}

        {/* Content */}
        <div style={{
          textAlign: 'center', padding: '10px 24px 0',
          fontSize: '14px', color: 'var(--mist)', lineHeight: 1.7,
        }}>
          {step.content}
        </div>

        {/* Step counter */}
        <div style={{
          textAlign: 'center', padding: '12px 0 0',
          fontSize: '11px', color: 'var(--mist)', opacity: 0.6,
        }}>
          {idx + 1} / {steps.length}
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex', gap: '10px', padding: '16px 20px 20px',
          justifyContent: 'center',
        }}>
          {idx > 0 && (
            <button onClick={prev} style={outlineBtn}>前へ</button>
          )}
          <button onClick={next} style={primaryBtn}>{isLast ? '完了' : '次へ'}</button>
        </div>

        {/* Skip link */}
        <div style={{ textAlign: 'center', paddingBottom: '16px' }}>
          <button onClick={skip} style={linkBtn}>スキップ</button>
        </div>
      </div>

      {/* animation keyframe */}
      <style>{`
        @keyframes tutorialFadeIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
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
  padding: '10px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer',
  fontSize: '14px', fontWeight: 600,
  background: 'var(--cyan-deep)', color: '#fff',
  transition: 'opacity 0.15s',
}

const outlineBtn: React.CSSProperties = {
  padding: '10px 28px', borderRadius: '12px', cursor: 'pointer',
  fontSize: '14px', fontWeight: 600,
  background: 'transparent', color: 'var(--cyan-deep)',
  border: '1.5px solid var(--cyan-deep)',
  transition: 'opacity 0.15s',
}

const linkBtn: React.CSSProperties = {
  padding: '5px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer',
  fontSize: '12px', fontWeight: 500,
  background: 'transparent', color: 'var(--mist)',
  transition: 'color 0.15s',
}
