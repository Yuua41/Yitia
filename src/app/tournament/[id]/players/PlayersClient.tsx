'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { nanoid } from 'nanoid'
import type { Tournament, Player } from '@/types'
import HeaderIcons from '@/components/ui/HeaderIcons'
import { TutorialProvider, HelpButton } from '@/components/tutorial/TutorialOverlay'
import { playersSteps } from '@/components/tutorial/steps'
import TournamentStatusActions from '@/components/ui/TournamentStatusActions'

interface Props {
  tournament: Tournament
  players: Player[]
}

export default function PlayersClient({ tournament, players: initialPlayers }: Props) {
  const router = useRouter()
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
  const [bulkText, setBulkText] = useState(initialPlayers.map(p => p.name).join('\n'))
  const [bulkSaving, setBulkSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const initialPlayerCount = useRef(initialPlayers.length)
  const playerCountChanged = players.length !== initialPlayerCount.current

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

  // 人数変更時にレイアウト側へ通知
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('players-count-changed', { detail: playerCountChanged }))
    return () => { window.dispatchEvent(new CustomEvent('players-count-changed', { detail: false })) }
  }, [playerCountChanged])

  // レイアウトからの卓組再編リクエストを受け取る
  useEffect(() => {
    const handler = async () => {
      setRegenerating(true)
      await regenerateSchedule(players.map(p => p.id))
      setRegenerating(false)
      initialPlayerCount.current = players.length
      window.dispatchEvent(new CustomEvent('players-count-changed', { detail: false }))
      showToast('卓組を再生成しました')
      router.refresh()
    }
    window.addEventListener('players-regenerate-request', handler)
    return () => window.removeEventListener('players-regenerate-request', handler)
  }, [players, router]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 卓組を再生成する共通関数（黒子自動追加対応） */
  async function regenerateSchedule(currentPlayerIds: string[]) {
    const byeMode = tournament.config.byeMode ?? 'dummy'

    let allPlayerIds = [...currentPlayerIds]

    // デフォルト: 4の倍数に足りない分は黒子を自動追加
    if (byeMode === 'dummy' && allPlayerIds.length % 4 !== 0) {
      const shortage = 4 - (allPlayerIds.length % 4)
      const nextOrder = players.length > 0 ? Math.max(...players.map(p => p.seat_order)) + 1 : 0
      const dummyInserts = Array.from({ length: shortage }, (_, i) => ({
        tournament_id: tournament.id,
        name: `黒子${i + 1}`,
        seat_order: nextOrder + i,
        token: nanoid(12),
        bonus: 0,
      }))
      const { data: dummies, error: dErr } = await supabase
        .from('players')
        .insert(dummyInserts)
        .select()
      if (dErr || !dummies) {
        alert('黒子の追加に失敗しました: ' + dErr?.message)
        return
      }
      const updatedPlayers = [...players, ...dummies]
      setPlayers(updatedPlayers)
      setBulkText(updatedPlayers.map(p => p.name).join('\n'))
      allPlayerIds = [...allPlayerIds, ...dummies.map(d => d.id)]
    }

    // 既存のtables/resultsを削除
    const { data: existingTables } = await supabase
      .from('tables')
      .select('id')
      .eq('tournament_id', tournament.id)

    if (existingTables && existingTables.length > 0) {
      await supabase.from('results').delete().in('table_id', existingTables.map(t => t.id))
    }
    await supabase.from('tables').delete().eq('tournament_id', tournament.id)

    const { generateSchedule } = await import('@/lib/mahjong/calculator')
    const schedule = generateSchedule(allPlayerIds, tournament.num_rounds)

    for (const round of schedule) {
      for (const tbl of round.tables) {
        const { data: tableRow } = await supabase
          .from('tables')
          .insert({
            tournament_id: tournament.id,
            round_number: round.roundNumber,
            table_number: round.tables.indexOf(tbl) + 1,
            has_extra_sticks: false,
            is_validated: false,
          })
          .select()
          .single()
        if (!tableRow) continue

        await supabase.from('results').insert(
          tbl.seatOrder.map((pid, seatIdx) => ({
            table_id: tableRow.id,
            player_id: pid,
            seat_index: seatIdx,
            score: 0,
            point: 0,
            rank: 0,
            is_negative_mode: false,
          }))
        )
      }
    }
  }

  async function handleBulkSave() {
    const newNames = bulkText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean)
    if (newNames.length < 4) return alert('プレイヤーを4名以上入力してください')

    let adjustedNames = [...newNames]
    while (adjustedNames.length % 4 !== 0) {
      adjustedNames.push(`黒子${4 - (adjustedNames.length % 4)}`)
    }

    const playersChanged = adjustedNames.length !== players.length ||
      adjustedNames.some((n, i) => n !== players[i]?.name)
    if (!playersChanged) return showToast('変更はありません')

    const ok = confirm('参加者を一括更新します。卓組が再生成され，入力済みのスコアは削除されます。よろしいですか？')
    if (!ok) return

    setBulkSaving(true)

    // 既存プレイヤーを削除して新規作成
    await supabase.from('players').delete().eq('tournament_id', tournament.id)
    const { data: newPlayers, error: pErr } = await supabase
      .from('players')
      .insert(adjustedNames.map((n, idx) => ({
        tournament_id: tournament.id,
        name: n,
        seat_order: idx,
        token: nanoid(12),
        bonus: 0,
      })))
      .select()
    if (pErr || !newPlayers) {
      alert('プレイヤー更新失敗: ' + pErr?.message)
      setBulkSaving(false)
      return
    }

    await regenerateSchedule(newPlayers.map(p => p.id))
    setPlayers(newPlayers)
    setBulkText(newPlayers.map(p => p.name).join('\n'))
    initialPlayerCount.current = newPlayers.length
    setBulkSaving(false)
    showToast('参加者を一括更新しました')
    router.refresh()
  }

  async function handleRegenerate() {
    const ok = confirm('卓組を再生成します。入力済みのスコアは削除されます。よろしいですか？')
    if (!ok) return

    setRegenerating(true)
    await regenerateSchedule(players.map(p => p.id))
    setRegenerating(false)
    showToast('卓組を再生成しました')
    router.refresh()
  }

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
    const ok = confirm(`「${player.name}」を削除しますか？\n卓組が再生成され，入力済みのスコアは削除されます。`)
    if (!ok) return

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', player.id)

    if (error) {
      alert('削除に失敗しました: ' + error.message)
      return
    }

    const updatedPlayers = players.filter(p => p.id !== player.id)
    setPlayers(updatedPlayers)
    setBulkText(updatedPlayers.map(p => p.name).join('\n'))
    await regenerateSchedule(updatedPlayers.map(p => p.id))
    showToast(`「${player.name}」を削除しました`)
    router.refresh()
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

    const updatedPlayers = [...players, data]
    setPlayers(updatedPlayers)
    setBulkText(updatedPlayers.map(p => p.name).join('\n'))
    setNewName('')
    await regenerateSchedule(updatedPlayers.map(p => p.id))
    setAdding(false)
    showToast(`「${data.name}」を追加しました`)
    router.refresh()
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mist)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tournament.name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '100px', fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em', flexShrink: 0, background: tournament.status === 'ongoing' ? 'var(--cyan-pale)' : tournament.status === 'finished' ? 'var(--gold-pale)' : 'var(--hover-bg)', color: tournament.status === 'ongoing' ? 'var(--cyan)' : tournament.status === 'finished' ? 'var(--gold)' : 'var(--mist)' }}>{tournament.status === 'ongoing' ? '進行中' : tournament.status === 'finished' ? '完了' : '下書き'}</span>
          <TournamentStatusActions tournament={tournament} />
        </div>
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
              {tournament.status === 'draft' && (
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
              )}
            </div>
          </div>

          {/* テキスト一括編集 (下書き時のみ) */}
          {tournament.status === 'draft' && (
          <div style={{
            background: 'var(--card-bg)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid var(--card-border)',
            borderRadius: '12px', padding: '18px', marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mist)' }}>一括編集</div>
              <div style={{ fontSize: '10px', color: 'var(--mist)' }}>改行または半角カンマ区切り</div>
            </div>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'var(--paper)', border: '1.5px solid var(--border-md)',
                borderRadius: '9px', fontSize: '13px', color: 'var(--ink)', outline: 'none',
                fontFamily: 'inherit', minHeight: '100px', resize: 'vertical', lineHeight: 1.65,
                boxSizing: 'border-box',
              }}
              placeholder={"プレイヤー名A\nプレイヤー名B\nプレイヤー名C"}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--mist)' }}>
                {bulkText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length} 名入力中
                {bulkText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length % 4 !== 0 && (
                  <span style={{ color: 'var(--slate)', marginLeft: '6px' }}>
                    (4の倍数になるよう黒子が追加されます)
                  </span>
                )}
              </div>
              <button
                onClick={handleBulkSave}
                disabled={bulkSaving}
                style={{
                  padding: '6px 16px', borderRadius: '7px',
                  background: 'transparent', color: 'var(--cyan-deep)',
                  border: '1.5px solid var(--cyan-deep)', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', opacity: bulkSaving ? 0.6 : 1,
                }}
              >{bulkSaving ? '保存中...' : '一括更新'}</button>
            </div>
          </div>
          )}

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

                {tournament.status === 'draft' && (
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
                )}

                <button
                  onClick={() => setQrPlayerId(player.id)}
                  title="QRコード"
                  style={{
                    color: 'var(--mist)', background: 'var(--paper)',
                    border: '1px solid var(--border)', borderRadius: '5px',
                    padding: '3px 7px', cursor: 'pointer',
                    flexShrink: 0, transition: 'color 0.1s, border-color 0.1s',
                    lineHeight: 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan-deep)'; e.currentTarget.style.borderColor = 'rgba(0,240,255,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--mist)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="4" height="4"/><line x1="22" y1="14" x2="22" y2="18"/><line x1="18" y1="22" x2="22" y2="22"/></svg></button>

              </div>
            ))}

            {/* 参加者追加 (下書き時のみ) */}
            {tournament.status === 'draft' && (
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
            )}
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
              {['連絡先', 'メモ', 'マッチング設定', 'プロ同卓設定'].map(label => (
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

      {/* 下部固定フッター (終了後は非表示) */}
      {tournament.status !== 'finished' && (
      <div className="players-header" style={{
        borderTop: '1px solid var(--header-border)',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: '600px', padding: '14px 0', display: 'flex', gap: '10px' }}>
          <button onClick={handleRefresh} disabled={refreshing} style={{
            flex: 1, padding: '10px', background: 'transparent', color: 'var(--cyan-deep)',
            border: '1.5px solid var(--cyan-deep)', borderRadius: '8px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            opacity: refreshing ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            {refreshing ? '保存中...' : '保存'}
          </button>
          <button onClick={handleRegenerate} disabled={regenerating} style={{
            flex: 1, padding: '10px', background: 'transparent', color: 'var(--gold)',
            border: '1.5px solid var(--gold)', borderRadius: '8px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            opacity: regenerating ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            {regenerating ? '再編中...' : '卓組を再編'}
          </button>
        </div>
      </div>
      )}

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
