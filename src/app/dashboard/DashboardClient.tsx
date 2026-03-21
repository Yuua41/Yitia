'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, RuleConfig } from '@/types'
import { nanoid } from 'nanoid'
import HeaderIcons from '@/components/ui/HeaderIcons'
import { TutorialProvider, HelpButton } from '@/components/tutorial/TutorialOverlay'
import { dashboardSteps } from '@/components/tutorial/steps'

interface Props {
  tournaments: Tournament[]
}

const DEFAULT_CONFIG: RuleConfig = {
  startingPoints: 25000,
  returnPoints: 30000,
  uma: [30, 10, -10, -30],
  tieBreak: 'split',
  seatMode: 'random',
  umaMode: 'simple',
  rounding: 'none',
}

export default function DashboardClient({ tournaments }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [name, setName] = useState('')
  const [heldOn, setHeldOn] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [playerCount, setPlayerCount] = useState(8)
  const [numRounds, setNumRounds] = useState(4)

  async function handleCreate() {
    if (!name.trim()) return showToast('大会名を入力してください')
    if (playerCount < 4) return showToast('プレイヤーを4名以上入力してください')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        held_on: heldOn || null,
        notes: notes || null,
        num_rounds: numRounds,
        config: DEFAULT_CONFIG,
        admin_token: nanoid(12),
        status: 'draft',
      })
      .select()
      .single()

    if (error || !tournament) {
      showToast('作成に失敗しました: ' + error?.message)
      setSaving(false)
      return
    }

    const adjustedCount = playerCount % 4 === 0 ? playerCount : playerCount + (4 - playerCount % 4)
    const adjustedNames = Array.from({ length: adjustedCount }, (_, i) =>
      i < playerCount ? `プレイヤー${i + 1}` : `黒子${i - playerCount + 1}`
    )

    const playersToInsert = adjustedNames.map((n, idx) => ({
      tournament_id: tournament.id,
      name: n,
      seat_order: idx,
      token: nanoid(12),
      bonus: 0,
    }))

    const { data: players, error: pErr } = await supabase
      .from('players')
      .insert(playersToInsert)
      .select()

    if (pErr || !players) {
      showToast('プレイヤー作成失敗: ' + pErr?.message)
      setSaving(false)
      return
    }

    const { generateSchedule } = await import('@/lib/mahjong/calculator')
    const playerIds = players.map(p => p.id)
    const schedule = generateSchedule(playerIds, numRounds)

    for (const round of schedule) {
      for (const tbl of round.tables) {
        const { data: tableRow, error: tErr } = await supabase
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

        if (tErr || !tableRow) continue

        const resultsToInsert = tbl.seatOrder.map((pid, seatIdx) => ({
          table_id: tableRow.id,
          player_id: pid,
          seat_index: seatIdx,
          score: 0,
          point: 0,
          rank: 0,
          is_negative_mode: false,
        }))

        await supabase.from('results').insert(resultsToInsert)
      }
    }

    router.push(`/tournament/${tournament.id}/settings`)
    router.refresh()
  }

  async function handleDuplicate(t: Tournament) {
    const ok = confirm(`「${t.name}」のコピーを作成しますか？\n参加者・ルール設定が引き継がれ、スコアなしの新しい下書きが作成されます。`)
    if (!ok) return

    setDuplicatingId(t.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDuplicatingId(null); return }

    const { data: sourcePlayers } = await supabase
      .from('players')
      .select('name, seat_order, bonus')
      .eq('tournament_id', t.id)
      .order('seat_order')

    if (!sourcePlayers) { setDuplicatingId(null); return }

    const { data: newTournament, error: tErr } = await supabase
      .from('tournaments')
      .insert({
        owner_id: user.id,
        name: t.name + '_コピー',
        held_on: t.held_on,
        notes: t.notes,
        num_rounds: t.num_rounds,
        config: t.config,
        admin_token: nanoid(12),
        status: 'draft',
      })
      .select()
      .single()

    if (tErr || !newTournament) {
      showToast('複製に失敗しました: ' + tErr?.message)
      setDuplicatingId(null)
      return
    }

    const { data: newPlayers, error: pErr } = await supabase
      .from('players')
      .insert(sourcePlayers.map(p => ({
        tournament_id: newTournament.id,
        name: p.name,
        seat_order: p.seat_order,
        token: nanoid(12),
        bonus: p.bonus,
      })))
      .select()

    if (pErr || !newPlayers) {
      showToast('プレイヤー複製失敗: ' + pErr?.message)
      setDuplicatingId(null)
      return
    }

    const { generateSchedule } = await import('@/lib/mahjong/calculator')
    const playerIds = newPlayers.map(p => p.id)
    const schedule = generateSchedule(playerIds, newTournament.num_rounds)

    for (const round of schedule) {
      for (const tbl of round.tables) {
        const { data: tableRow } = await supabase
          .from('tables')
          .insert({
            tournament_id: newTournament.id,
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

    setDuplicatingId(null)
    router.push(`/tournament/${newTournament.id}/settings`)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const { data: tables } = await supabase
      .from('tables')
      .select('id')
      .eq('tournament_id', deleteTarget.id)

    if (tables && tables.length > 0) {
      const tableIds = tables.map(t => t.id)
      const { error: e1 } = await supabase.from('results').delete().in('table_id', tableIds)
      if (e1) { console.error('results delete error:', e1); showToast('削除失敗(results): ' + e1.message); setDeleting(false); return }
    }

    const { error: e2 } = await supabase.from('tables').delete().eq('tournament_id', deleteTarget.id)
    if (e2) { console.error('tables delete error:', e2); showToast('削除失敗(tables): ' + e2.message); setDeleting(false); return }

    const { error: e3 } = await supabase.from('players').delete().eq('tournament_id', deleteTarget.id)
    if (e3) { console.error('players delete error:', e3); showToast('削除失敗(players): ' + e3.message); setDeleting(false); return }

    const { error: e4 } = await supabase.from('tournaments').delete().eq('id', deleteTarget.id)
    if (e4) { console.error('tournaments delete error:', e4); showToast('削除失敗(tournaments): ' + e4.message); setDeleting(false); return }

    setDeleting(false)
    setDeleteTarget(null)
    router.refresh()
  }

  const statusLabel = (t: Tournament) => {
    if (t.status === 'ongoing') return { text: '進行中', color: 'var(--cyan)', bg: 'var(--cyan-pale)' }
    if (t.status === 'finished') return { text: '完了', color: 'var(--gold)', bg: 'var(--gold-pale)' }
    return { text: '下書き', color: 'var(--mist)', bg: 'var(--hover-bg)' }
  }

  return (
    <TutorialProvider>
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media (max-width: 768px) {
          .dash-header { padding: 0 16px !important; }
          .dash-content { padding: 16px !important; }
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="dash-header" style={{
        height: '56px',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--header-border)',
        padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        position: 'relative', zIndex: 100, overflow: 'visible',
      }}>
        <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' }}>大会一覧</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpButton steps={dashboardSteps} pageKey="dashboard" />
          <HeaderIcons />
        </div>
      </div>

      <div className="dash-content" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--mist)' }}>{tournaments.length}件の大会</div>
        </div>

        <div data-tutorial="tournament-cards" className="dash-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {tournaments.map(t => {
            const s = statusLabel(t)
            return (
              <div key={t.id} style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '16px', overflow: 'hidden',
                cursor: navigatingId ? 'wait' : 'pointer',
                transition: 'box-shadow 0.2s, background 0.2s, opacity 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                opacity: navigatingId && navigatingId !== t.id ? 0.4 : 1,
                position: 'relative',
              }}
                onMouseEnter={e => { if (!navigatingId) { e.currentTarget.style.boxShadow = '0 8px 36px rgba(0,0,0,0.15), 0 0 20px var(--hover-bg)'; e.currentTarget.style.background = 'var(--card-bg)' } }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'; e.currentTarget.style.background = 'var(--card-bg)' }}
              >
                {/* ステータスに応じた上部カラーバー */}
                <div style={{
                  height: '4px',
                  background: t.status === 'ongoing'
                    ? 'linear-gradient(90deg, var(--cyan), var(--cyan-dim))'
                    : t.status === 'finished' ? 'var(--gold)' : 'var(--border-md)',
                }} />

                {/* ローディングシマー */}
                {navigatingId === t.id && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    background: 'var(--header-bg)',
                    backdropFilter: 'blur(3px)',
                  }}>
                    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                      <div className="skeleton-pulse" style={{ width: '52px', height: '22px', borderRadius: '100px' }} />
                      <div className="skeleton-pulse" style={{ width: '65%', height: '18px' }} />
                      <div className="skeleton-pulse" style={{ width: '45%', height: '12px' }} />
                    </div>
                  </div>
                )}

                {/* カード本体 */}
                <div style={{ padding: '14px 16px 18px' }}>
                  {/* 上段: ステータスバッジ + アクションボタン（近接・整列） */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '3px 10px', borderRadius: '100px',
                      fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
                      background: s.bg, color: s.color,
                    }}>{s.text}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleDuplicate(t) }}
                        disabled={!!duplicatingId}
                        title="複製"
                        style={{
                          width: '26px', height: '26px', borderRadius: '8px',
                          background: 'transparent', border: '1px solid var(--border-md)',
                          color: duplicatingId === t.id ? 'var(--cyan-deep)' : 'var(--mist)',
                          fontSize: '11px', cursor: duplicatingId ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.13s',
                        }}
                        onMouseEnter={e => { if (!duplicatingId) { e.currentTarget.style.background = 'var(--cyan-pale)'; e.currentTarget.style.color = 'var(--cyan)' } }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--mist)' }}
                      >{duplicatingId === t.id ? '…' : '⧉'}</button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(t) }}
                        style={{
                          width: '26px', height: '26px', borderRadius: '8px',
                          background: 'transparent', border: '1px solid var(--border-md)',
                          color: 'var(--mist)', fontSize: '11px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.13s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-pale)'; e.currentTarget.style.color = 'var(--red)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--mist)' }}
                      >✕</button>
                    </div>
                  </div>

                  {/* タイトル（コントラスト強調） */}
                  <div onClick={() => {
                    setNavigatingId(t.id)
                    const dest = t.status === 'draft' ? 'settings' : t.status === 'finished' ? 'standings' : 'schedule'
                    router.push(`/tournament/${t.id}/${dest}`)
                  }}>
                    <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3, marginBottom: '8px', color: 'var(--ink)' }}>
                      {t.name}
                    </div>
                    {/* メタ情報（反復・整列） */}
                    <div style={{ fontSize: '12px', color: 'var(--mist)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span>{t.held_on ?? '日程未定'}</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{t.num_rounds}回戦</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{t.players?.length ?? 0}名</span>
                    </div>
                    {t.notes && (
                      <div style={{
                        fontSize: '12px', color: 'var(--mist)',
                        marginTop: '10px', lineHeight: 1.6,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      } as React.CSSProperties}>{t.notes}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          <div
            data-tutorial="new-tournament"
            onClick={() => setShowForm(true)}
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              padding: '18px 20px', gap: '14px',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--card-bg)'
              e.currentTarget.style.borderColor = 'var(--border-md)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--card-bg)'
              e.currentTarget.style.borderColor = 'var(--card-border)'
            }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              border: '1.5px solid var(--border-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', color: 'var(--cyan-deep)', fontWeight: 300, flexShrink: 0,
            }}>+</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>新しい大会を作成</div>
              <div style={{ fontSize: '11px', color: 'var(--mist)', marginTop: '2px' }}>大会情報を入力して開始</div>
            </div>
          </div>
        </div>
      </div>

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,21,32,0.5)',
          backdropFilter: 'blur(4px)', zIndex: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <div style={{
            background: 'var(--header-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid var(--card-border)',
            borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '380px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          }}>
            <div style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--red)' }}>削除</div>
            <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px' }}>大会を削除しますか？</div>
            <div style={{
              fontSize: '13px', color: 'var(--ink)', marginBottom: '6px',
              background: 'var(--surface)', padding: '10px 13px', borderRadius: '8px',
              fontWeight: 600,
            }}>「{deleteTarget.name}」</div>
            <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '22px' }}>
              この操作は取り消せません。卓組・スコア・成績がすべて削除されます。
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={btnOutline}
              >キャンセル</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: '8px 18px', background: deleting ? 'var(--mist)' : 'var(--red)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >{deleting ? '削除中...' : '削除する'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 大会作成モーダル */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,21,32,0.5)',
          backdropFilter: 'blur(4px)', zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <div style={{
            background: 'var(--header-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid var(--card-border)',
            borderRadius: '16px', padding: 'clamp(20px, 4vw, 28px)',
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          }}>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '20px' }}>新しい大会を作成</div>

            <div style={{ marginBottom: '13px' }}>
              <label style={labelStyle}>大会名 *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="例：第1回 春季大会" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '13px' }}>
              <div>
                <label style={labelStyle}>開催日</label>
                <input type="date" value={heldOn} onChange={e => setHeldOn(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>試合数</label>
                <select value={numRounds} onChange={e => setNumRounds(+e.target.value)} style={inputStyle}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}回戦</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '13px' }}>
              <label style={labelStyle}>参加人数</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPlayerCount(c => Math.max(4, c - 1))}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid var(--border-md)', background: 'var(--surface)', color: 'var(--ink)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >−</button>
                <input
                  type="number"
                  min={4}
                  value={playerCount}
                  onChange={e => setPlayerCount(Math.max(4, parseInt(e.target.value) || 4))}
                  style={{ ...inputStyle, width: '70px', textAlign: 'center', flexShrink: 0 }}
                />
                <button
                  type="button"
                  onClick={() => setPlayerCount(c => c + 1)}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid var(--border-md)', background: 'var(--surface)', color: 'var(--ink)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >＋</button>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[8, 12, 16, 20, 24, 28, 32, 36, 40].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPlayerCount(n)}
                      style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        border: playerCount === n ? '1.5px solid var(--cyan-deep)' : '1.5px solid var(--border-md)',
                        background: playerCount === n ? 'var(--cyan-pale)' : 'var(--surface)',
                        color: playerCount === n ? 'var(--cyan-deep)' : 'var(--mist)',
                        fontWeight: playerCount === n ? 700 : 400,
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
              {playerCount % 4 !== 0 && (
                <div style={{ fontSize: '12px', color: 'var(--mist)', marginTop: '5px' }}>
                  <span style={{ color: 'var(--slate)' }}>
                    （{4 - playerCount % 4}名の黒子を追加して{playerCount + (4 - playerCount % 4)}名に調整されます）
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>備考</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', minHeight: '70px', resize: 'vertical', lineHeight: 1.65 }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={btnOutline}>キャンセル</button>
              <button onClick={handleCreate} disabled={saving} style={{
                padding: '10px 22px', background: 'transparent',
                color: 'var(--cyan-deep)', border: '1.5px solid var(--cyan-deep)',
                borderRadius: '7px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? '作成中...' : '大会を作成する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, pointerEvents: 'none',
          background: toast.type === 'error' ? '#dc2626' : 'var(--navy)',
          color: '#fff', padding: '10px 20px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
    </TutorialProvider>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--mist)', marginBottom: '5px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', height: '44px', padding: '0 12px',
  background: 'var(--surface)', border: '1.5px solid var(--border-md)',
  borderRadius: '9px', fontSize: '15px', color: 'var(--ink)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const btnOutline: React.CSSProperties = {
  padding: '10px 20px', background: 'var(--surface)',
  border: '1.5px solid var(--border-md)', color: 'var(--slate)',
  borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
}
