'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { nanoid } from 'nanoid'
import type { Tournament, Player } from '@/types'
import HeaderIcons from '@/components/ui/HeaderIcons'
import { TutorialProvider, HelpButton } from '@/components/tutorial/TutorialOverlay'
import { playersSteps } from '@/components/tutorial/steps'

interface Props {
  tournament: Tournament
  players: Player[]
}

export default function PlayersClient({ tournament, players: initialPlayers }: Props) {
  const supabase = createClient()
  const [players, setPlayers] = useState(initialPlayers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [qrPlayerId, setQrPlayerId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  // ハッシュで指定されたプレーヤーにスクロール
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.outline = '2px solid var(--cyan-deep)'
        el.style.outlineOffset = '2px'
        setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = '' }, 2000)
      }, 300)
    }
  }, [])

  // 未保存状態でのページ離脱アラート
  useEffect(() => {
    if (!editingId) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editingId])

  async function handleRefresh() {
    setRefreshing(true)
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('seat_order')
    if (!error && data) {
      setPlayers(data)
      showToast('保存しました')
    }
    setRefreshing(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function startEdit(player: Player) {
    setEditingId(player.id)
    setEditName(player.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
  }

  async function saveName(playerId: string) {
    const trimmed = editName.trim()
    if (!trimmed) return cancelEdit()

    const player = players.find(p => p.id === playerId)
    if (player && player.name === trimmed) return cancelEdit()

    setSaving(true)
    const { error } = await supabase
      .from('players')
      .update({ name: trimmed })
      .eq('id', playerId)

    if (error) {
      alert('保存に失敗しました: ' + error.message)
      setSaving(false)
      return
    }

    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, name: trimmed } : p))
    setEditingId(null)
    setEditName('')
    setSaving(false)
    showToast('保存しました')
  }

  async function handleDeletePlayer(player: Player) {
    const ok = confirm(`「${player.name}」を削除しますか？\nこの参加者のスコアデータも全て削除されます。`)
    if (!ok) return

    const { error: rErr } = await supabase
      .from('results')
      .delete()
      .eq('player_id', player.id)

    if (rErr) {
      alert('削除に失敗しました: ' + rErr.message)
      return
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', player.id)

    if (error) {
      alert('削除に失敗しました: ' + error.message)
      return
    }

    setPlayers(prev => prev.filter(p => p.id !== player.id))
    showToast(`「${player.name}」を削除しました`)
  }

  async function handleAddPlayer() {
    const trimmed = newName.trim()
    if (!trimmed) return

    setAdding(true)
    const nextOrder = players.length > 0 ? Math.max(...players.map(p => p.seat_order)) + 1 : 0

    const { data, error } = await supabase
      .from('players')
      .insert({
        tournament_id: tournament.id,
        name: trimmed,
        seat_order: nextOrder,
        token: nanoid(12),
        bonus: 0,
      })
      .select()
      .single()

    if (error) {
      alert('追加に失敗しました: ' + error.message)
      setAdding(false)
      return
    }

    setPlayers(prev => [...prev, data])
    setNewName('')
    setAdding(false)
    showToast(`「${data.name}」を追加しました`)
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const qrPlayer = qrPlayerId ? players.find(p => p.id === qrPlayerId) : null

  return (
    <TutorialProvider>
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .players-header { padding: 0 26px; }
        .players-content { padding: 24px 26px; }
        @media (max-width: 768px) {
          .players-header { padding: 0 16px !important; }
          .players-content { padding: 16px !important; }
        }
      `}</style>

      <div className="players-header" style={{
        height: '52px', background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--header-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        position: 'relative', zIndex: 100, overflow: 'visible',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mist)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tournament.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <HelpButton steps={playersSteps} pageKey="players" />
          <HeaderIcons />
        </div>
      </div>

      <div className="players-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontFamily: "var(--font-jp, 'M PLUS 1p'), sans-serif", fontSize: '20px', fontWeight: 800 }}>参加者</div>
              <span style={{
                display: 'inline-flex', padding: '2px 8px', borderRadius: '5px',
                fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
                background: 'var(--paper)', color: 'var(--slate)', border: '1px solid var(--border)',
              }}>{players.length}名</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => {
                  addInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  setTimeout(() => addInputRef.current?.focus(), 400)
                }}
                style={{
                  padding: '5px 14px', borderRadius: '7px',
                  background: 'transparent', color: 'var(--gold)',
                  border: '1.5px solid var(--gold)', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                追加
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  padding: '5px 14px', borderRadius: '7px',
                  background: 'transparent', color: 'var(--cyan-deep)',
                  border: '1.5px solid var(--cyan-deep)', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', opacity: refreshing ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
                {refreshing ? '保存中...' : '保存'}
              </button>
            </div>
          </div>

          {/* 参加者一覧 */}
          <div data-tutorial="players-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {players.map((player, idx) => (
              <div key={player.id} id={`player-${player.id}`} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px',
                background: 'var(--card-bg)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1.5px solid var(--card-border)',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'var(--paper)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
                  color: 'var(--mist)', flexShrink: 0,
                }}>{idx + 1}</div>

                {editingId === player.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveName(player.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    onBlur={() => saveName(player.id)}
                    disabled={saving}
                    style={{
                      flex: 1, padding: '5px 10px',
                      background: 'var(--paper)', border: '1.5px solid var(--cyan-deep)',
                      borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                      color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <div style={{ flex: 1, padding: '5px 10px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                    {player.name}
                  </div>
                )}

                <button
                  onClick={() => startEdit(player)}
                  title="名前を編集"
                  style={{
                    fontSize: '13px',
                    color: 'var(--mist)', background: 'var(--paper)',
                    border: '1px solid var(--border)', borderRadius: '5px',
                    padding: '3px 7px', cursor: 'pointer',
                    flexShrink: 0, transition: 'color 0.1s, border-color 0.1s',
                    lineHeight: 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan-deep)'; e.currentTarget.style.borderColor = 'rgba(0,240,255,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--mist)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>

                <button
                  onClick={() => handleDeletePlayer(player)}
                  style={{
                    fontSize: '11px', fontFamily: 'monospace',
                    color: 'var(--mist)', background: 'var(--paper)',
                    border: '1px solid var(--border)', borderRadius: '5px',
                    padding: '3px 7px', cursor: 'pointer',
                    flexShrink: 0, transition: 'color 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--mist)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>

                <button
                  onClick={() => setQrPlayerId(player.id)}
                  style={{
                    fontSize: '10px', fontFamily: 'monospace',
                    color: 'var(--mist)', background: 'var(--paper)',
                    border: '1px solid var(--border)', borderRadius: '5px',
                    padding: '3px 7px', cursor: 'pointer',
                    flexShrink: 0, transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan-deep)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--mist)')}
                >QR</button>

                <a
                  href={`/p/${player.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '10px', fontFamily: 'monospace',
                    color: 'var(--mist)', textDecoration: 'none',
                    padding: '3px 7px', borderRadius: '5px',
                    background: 'var(--paper)', border: '1px solid var(--border)',
                    flexShrink: 0, transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan-deep)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--mist)')}
                >
                  個人ページ →
                </a>
              </div>
            ))}

            {/* 参加者追加 */}
            <div data-tutorial="players-add" style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px',
              background: 'var(--card-bg)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px dashed var(--border-md)',
              borderRadius: '10px',
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'var(--cyan-pale)', border: '1px solid rgba(0,240,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, color: 'var(--cyan-deep)', flexShrink: 0,
              }}>+</div>
              <input
                ref={addInputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddPlayer() }}
                placeholder="新しい参加者名を入力..."
                disabled={adding}
                style={{
                  flex: 1, padding: '5px 10px',
                  background: 'var(--paper)', border: '1.5px solid var(--border-md)',
                  borderRadius: '7px', fontSize: '13px',
                  color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleAddPlayer}
                disabled={adding || !newName.trim()}
                style={{
                  padding: '5px 14px', borderRadius: '7px',
                  background: !newName.trim() ? 'var(--paper)' : 'var(--cyan-deep)',
                  color: !newName.trim() ? 'var(--mist)' : '#fff',
                  border: 'none', fontSize: '12px', fontWeight: 600,
                  cursor: !newName.trim() ? 'default' : 'pointer',
                  flexShrink: 0,
                }}
              >{adding ? '追加中...' : '追加'}</button>
            </div>
          </div>

          {/* 将来拡張エリア */}
          <div style={{
            marginTop: '20px', background: 'var(--paper)',
            border: '1.5px dashed var(--border-md)',
            borderRadius: '12px', padding: '20px',
          }}>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: '10px' }}>
              Coming Soon
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['連絡先', 'メモ', 'プロ同卓設定'].map(label => (
                <span key={label} style={{
                  padding: '5px 12px', borderRadius: '6px',
                  background: 'rgba(0,240,255,0.05)', border: '1px solid var(--border)',
                  fontSize: '11px', color: 'var(--mist)',
                }}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* トースト通知 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, background: 'var(--navy)', color: '#fff',
          padding: '10px 20px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}

      {/* QRモーダル */}
      {qrPlayer && (
        <div
          onClick={() => setQrPlayerId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--header-bg)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--card-border)',
              borderRadius: '16px', padding: '28px',
              textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px var(--header-border)',
              maxWidth: '300px', width: '90%',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
              {qrPlayer.seat_order + 1}. {qrPlayer.name}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--mist)', fontFamily: 'monospace', marginBottom: '16px' }}>
              個人ページ QR
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <QRCode value={`${origin}/p/${qrPlayer.token}`} size={180} />
            </div>
            <div
              onClick={() => window.open(`/p/${qrPlayer.token}`, '_blank')}
              style={{
                fontSize: '10px', fontFamily: 'monospace', color: 'var(--cyan-deep)',
                cursor: 'pointer', textDecoration: 'underline', marginBottom: '16px',
              }}
            >/p/{qrPlayer.token}</div>
            <button
              onClick={() => setQrPlayerId(null)}
              style={{
                padding: '7px 20px', background: 'var(--header-border)',
                border: '1px solid rgba(0,240,255,0.15)', borderRadius: '8px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'var(--slate)',
              }}
            >閉じる</button>
          </div>
        </div>
      )}
    </div>
    </TutorialProvider>
  );
}

function QRCode({ value, size }: { value: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    import('qrcode').then(QRCodeLib => {
      QRCodeLib.toCanvas(canvasRef.current!, value, {
        width: size,
        margin: 1,
        color: { dark: '#0a0e1a', light: '#ffffff' },
      })
    })
  }, [value, size])
  return <canvas ref={canvasRef} style={{ borderRadius: '8px', display: 'block', margin: '0 auto' }} />
}
