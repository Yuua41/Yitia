'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  onClick: () => void
  storageKey?: string
}

export default function DraggableMenuButton({ onClick, storageKey = 'hamburger-pos' }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const dragging = useRef(false)
  const hasMoved = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const startBtn = useRef({ x: 0, y: 0 })

  const [pos, setPos] = useState<{ right: number; bottom: number } | null>(null)

  // Load saved position from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const p = JSON.parse(saved)
        if (typeof p.right === 'number' && typeof p.bottom === 'number') {
          setPos(p)
          return
        }
      }
    } catch { /* ignore */ }
    setPos({ right: 10, bottom: 10 })
  }, [storageKey])

  const clamp = useCallback((right: number, bottom: number) => {
    const maxR = window.innerWidth - 50
    const maxB = window.innerHeight - 50
    return {
      right: Math.max(4, Math.min(right, maxR)),
      bottom: Math.max(4, Math.min(bottom, maxB)),
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    hasMoved.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      startBtn.current = {
        x: window.innerWidth - rect.right + rect.width / 2,
        y: window.innerHeight - rect.bottom + rect.height / 2,
      }
    }
    btnRef.current?.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) hasMoved.current = true
    if (!hasMoved.current) return
    const newPos = clamp(startBtn.current.x - dx, startBtn.current.y - dy)
    setPos(newPos)
  }, [clamp])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    btnRef.current?.releasePointerCapture(e.pointerId)
    if (!hasMoved.current) {
      onClick()
    } else if (pos) {
      try { localStorage.setItem(storageKey, JSON.stringify(pos)) } catch { /* ignore */ }
    }
    dragging.current = false
  }, [onClick, pos, storageKey])

  if (!pos) return null

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'fixed',
        right: `${pos.right}px`,
        bottom: `${pos.bottom}px`,
        zIndex: 999,
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sidebar-bg, var(--navy))',
        border: '1px solid var(--sidebar-border, var(--border-md))',
        borderRadius: '12px',
        color: 'var(--text-on-sidebar)',
        fontSize: '22px',
        cursor: 'grab',
        touchAction: 'none',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      ☰
    </button>
  )
}
