'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, RuleTemplate, RuleConfig } from '@/types'
import { nanoid } from 'nanoid'

interface Props {
  tournaments: Tournament[]
  templates: RuleTemplate[]
}

const DEFAULT_CONFIG: RuleConfig = {
  startingPoints: 25000,
  returnPoints: 30000,
  uma: [30, 10, -10, -30],
  tieBreak: 'split',
  seatMode: 'random',
  umaMode: 'simple',
}

export default function DashboardClient({ tournaments, templates }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState('')
  const [heldOn, setHeldOn] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [playerText, setPlayerText] = useState('')
  const [numRounds, setNumRounds] = useState(4)
  const [config, setConfig] = useState<RuleConfig>(DEFAULT_CONFIG)
  const [umaMode, setUmaMode] = useState<'simple' | 'detail'>('simple')
  const [uma1, setUma1] = useState(30)
  const [uma4, setUma4] = useState(-30)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  function applyTemplate(tplId: string) {
    setSelectedTemplate(tplId)
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return
    setConfig(tpl.config)
    setUma1(tpl.config.uma[0])
    setUma4(tpl.config.uma[3])
  }

  function getUma(): [number, number, number, number] {
    if (umaMode === 'simple') {
      const u2 = Math.round(Math.abs(uma1) / 3)
      return [uma1, u2, -u2, uma4]
    }
    return config.uma
  }

  async function handleCreate() {
    if (!name.trim()) return alert('大会名を入力してください')
    const names = playerText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean)
    if (names.length < 4) return alert('プレイヤーを4名以上入力してください')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const finalConfig: RuleConfig = { ...config, uma: getUma(), umaMode }

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        held_on: heldOn || null,
        notes: notes || null,
        num_rounds: numRounds,
        config: finalConfig,
        status: 'ongoing',
      })
      .select()
      .single()

    if (error || !tournament) {
      alert('作成に失敗しました: ' + error?.message)
      setSaving(false)
      return
    }

    let adjustedNames = [...names]
    while (adjustedNames.length % 4 !== 0) {
      adjustedNames.push(`黒子${4 - (adjustedNames.length % 4)}`)
    }

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
      alert('プレイヤー作成失敗: ' + pErr?.message)
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

    router.push(`/tournament/${tournament.id}/schedule`)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    // resultsを削除（tablesに紐づく）
    const { data: tables } = await supabase
      .from('tables')
      .select('id')
      .eq('tournament_id', deleteTarget.id)

    if (tables && tables.length > 0) {
      const tableIds = tables.map(t => t.id)
      await supabase.from('results').delete().in('table_id', tableIds)
    }

    await supabase.from('tables').delete().eq('tournament_id', deleteTarget.id)
    await supabase.from('players').delete().eq('tournament_id', deleteTarget.id)
    await supabase.from('tournaments').delete().eq('id', deleteTarget.id)

    setDeleting(false)
    setDeleteTarget(null)
    router.refresh()
  }

  const statusLabel = (t: Tournament) => {
    if (t.status === 'ongoing') return { text: '進行中', color: 'var(--cyan-deep)', bg: 'var(--cyan-pale)' }
    if (t.status === 'finished') return { text: '完了', color: '#15803d', bg: '#f0fdf4' }
    return { text: '下書き', color: 'var(--mist)', bg: 'var(--paper)' }
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        height: '52px', background: '#fff', borderBottom: '1px solid var(--border)',
        padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'serif', fontSize: '16px', fontWeight: 700, letterSpacing: '0.04em' }}>大会一覧</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px' }}>
        <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800, marginBottom: '3px' }}>大会一覧</div>
        <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '20px' }}>大会を選択して管理・成績確認ができます</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' }}>
          {tournaments.map(t => {
            const s = statusLabel(t)
            return (
              <div key={t.id} style={{
                background: '#fff', border: '1.5px solid var(--border)',
                borderRadius: '12px', padding: '18px', cursor: 'pointer',
                transition: 'all 0.15s', boxShadow: '0 1px 8px rgba(15,21,32,0.07)',
                position: 'relative', overflow: 'hidden',
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: t.status === 'ongoing'
                    ? 'linear-gradient(90deg, #0ea5e9, #38bdf8)'
                    : t.status === 'finished' ? '#f59e0b' : 'var(--border-md)',
                }} />

                {/* 削除ボタン */}
                <button
                  onClick={e => { e.stopPropagation(); setDeleteTarget(t) }}
                  style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'transparent', border: '1px solid var(--border-md)',
                    color: 'var(--mist)', fontSize: '11px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.13s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-pale)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--mist)'; e.currentTarget.style.borderColor = 'var(--border-md)' }}
                >✕</button>

                <div
                  onClick={() => router.push(`/tournament/${t.id}/schedule`)}
                  style={{ paddingRight: '24px' }}
                >
                  <div style={{ fontFamily: 'serif', fontSize: '16px', fontWeight: 700, marginBottom: '5px' }}>{t.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'monospace', marginBottom: '8px' }}>
                    {t.held_on ?? '日程未定'} &nbsp;|&nbsp; {t.num_rounds}回戦
                  </div>
                  {t.notes && (
                    <div style={{
                      fontSize: '11.5px', color: 'var(--slate)',
                      background: 'var(--paper)', borderRadius: '7px',
                      padding: '7px 9px', border: '1px solid var(--border)',
                      lineHeight: 1.5, marginBottom: '10px',
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    } as React.CSSProperties}>{t.notes}</div>
                  )}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{
                      display: 'inline-flex', padding: '2px 8px', borderRadius: '5px',
                      fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
                      background: s.bg, color: s.color,
                    }}>{s.text}</span>
                  </div>
                </div>
              </div>
            )
          })}

          <div
            onClick={() => setShowForm(true)}
            style={{
              background: 'transparent', border: '1.5px dashed var(--border-md)',
              borderRadius: '12px', padding: '18px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: '148px', gap: '8px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.background = 'var(--cyan-pale)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ width: '40px', height: '40px', background: 'var(--cyan-pale)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>＋</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--mist)' }}>新しい大会を作成</div>
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
            background: '#fff', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '380px',
            boxShadow: '0 20px 60px rgba(15,21,32,0.2)',
          }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🗑️</div>
            <div style={{ fontFamily: 'serif', fontSize: '17px', fontWeight: 800, marginBottom: '8px' }}>大会を削除しますか？</div>
            <div style={{
              fontSize: '13px', color: 'var(--slate)', marginBottom: '6px',
              background: 'var(--paper)', padding: '10px 13px', borderRadius: '8px',
              fontWeight: 600,
            }}>「{deleteTarget.name}」</div>
            <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '22px' }}>
              この操作は取り消せません。卓組・スコア・成績がすべて削除されます。
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '8px 18px', background: 'transparent', border: '1.5px solid var(--border-md)', color: 'var(--slate)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
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
            background: '#fff', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(15,21,32,0.2)',
          }}>
            <div style={{ fontFamily: 'serif', fontSize: '18px', fontWeight: 800, marginBottom: '20px' }}>新しい大会を作成</div>

            {templates.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>ルールテンプレートから読み込む</label>
                <select value={selectedTemplate} onChange={e => applyTemplate(e.target.value)} style={inputStyle}>
                  <option value="">テンプレートを選択...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

            <div style={{ marginBottom: '13px' }}>
              <label style={labelStyle}>大会名 *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="例：第1回 春季大会" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '13px' }}>
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
              <label style={labelStyle}>プレイヤー名（改行またはカンマ区切り）</label>
              <textarea value={playerText} onChange={e => setPlayerText(e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', lineHeight: 1.65 }} placeholder="アカギ&#10;カイジ&#10;衣..." />
              <div style={{ fontSize: '11px', color: 'var(--mist)', marginTop: '3px' }}>
                {playerText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length} 名入力中
              </div>
            </div>

            <div style={{ background: 'var(--navy)', borderRadius: '11px', padding: '16px', marginBottom: '13px', color: '#fff' }}>
              <div style={cfgLabelStyle}>基本設定</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <div style={cfgItemLabelStyle}>持ち点</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="number" value={config.startingPoints / 1000} onChange={e => setConfig(c => ({ ...c, startingPoints: +e.target.value * 1000 }))} style={cfgInputStyle} />
                    <span style={{ padding: '7px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderLeft: 'none', borderRadius: '0 7px 7px 0', fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>,000</span>
                  </div>
                </div>
                <div>
                  <div style={cfgItemLabelStyle}>返し</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="number" value={config.returnPoints / 1000} onChange={e => setConfig(c => ({ ...c, returnPoints: +e.target.value * 1000 }))} style={cfgInputStyle} />
                    <span style={{ padding: '7px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderLeft: 'none', borderRadius: '0 7px 7px 0', fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>,000</span>
                  </div>
                </div>
              </div>

              <div style={cfgLabelStyle}>ウマ設定</div>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '7px', padding: '2px', gap: '2px', marginBottom: '10px' }}>
                {(['simple', 'detail'] as const).map(m => (
                  <button key={m} onClick={() => setUmaMode(m)} style={{
                    flex: 1, padding: '6px 4px', fontSize: '11px', fontWeight: 600,
                    border: 'none', borderRadius: '5px', cursor: 'pointer',
                    background: umaMode === m ? 'var(--cyan-deep)' : 'transparent',
                    color: umaMode === m ? '#fff' : 'rgba(255,255,255,0.38)',
                  }}>
                    {m === 'simple' ? 'シンプル' : '詳細（個別入力）'}
                  </button>
                ))}
              </div>

              {umaMode === 'simple' ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <div style={cfgItemLabelStyle}>1位ウマ</div>
                      <input type="number" value={uma1} onChange={e => setUma1(+e.target.value)} style={cfgInputStyle} />
                    </div>
                    <div>
                      <div style={cfgItemLabelStyle}>4位ウマ</div>
                      <input type="number" value={uma4} onChange={e => setUma4(+e.target.value)} style={{ ...cfgInputStyle, color: '#fca5a5' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {[
                      { label: '2位', val: `+${Math.round(Math.abs(uma1) / 3)}` },
                      { label: '3位', val: `−${Math.round(Math.abs(uma1) / 3)}` },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '5px 4px' }}>
                        <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '4px' }}>
                    {['1位','2位','3位','4位'].map(l => (
                      <div key={l} style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{l}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                    {config.uma.map((v, i) => (
                      <input key={i} type="number" value={v}
                        onChange={e => {
                          const uma = [...config.uma] as [number,number,number,number]
                          uma[i] = +e.target.value
                          setConfig(c => ({ ...c, uma }))
                        }}
                        style={{ ...cfgInputStyle, textAlign: 'center', color: i >= 2 ? '#fca5a5' : '#fff' }} />
                    ))}
                  </div>
                </div>
              )}

              <div style={cfgLabelStyle}>同点処理 / 席順</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <ToggleGroup
                  options={[{ value: 'kamicha', label: '上家取り' }, { value: 'split', label: '同点分け' }]}
                  value={config.tieBreak}
                  onChange={v => setConfig(c => ({ ...c, tieBreak: v as 'kamicha' | 'split' }))}
                />
                <ToggleGroup
                  options={[{ value: 'random', label: '席ランダム' }, { value: 'none', label: '席順なし' }]}
                  value={config.seatMode}
                  onChange={v => setConfig(c => ({ ...c, seatMode: v as 'random' | 'none' }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>備考</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', lineHeight: 1.65 }} placeholder="ルールの補足、チョンボ罰則など..." />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={btnOutline}>キャンセル</button>
              <button onClick={handleCreate} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                {saving ? '作成中...' : '大会を開始する →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '7px', padding: '2px', gap: '2px' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '6px 4px', fontSize: '11px', fontWeight: 600,
          border: 'none', borderRadius: '5px', cursor: 'pointer',
          background: value === o.value ? 'var(--cyan-deep)' : 'transparent',
          color: value === o.value ? '#fff' : 'rgba(255,255,255,0.38)',
          transition: 'all 0.13s',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--mist)', marginBottom: '5px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'var(--paper)', border: '1.5px solid var(--border-md)',
  borderRadius: '9px', fontSize: '13px', color: 'var(--ink)', outline: 'none',
  fontFamily: 'inherit',
}
const cfgLabelStyle: React.CSSProperties = {
  fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
  marginBottom: '10px', marginTop: '14px',
}
const cfgItemLabelStyle: React.CSSProperties = {
  fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.15em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', marginBottom: '4px',
}
const cfgInputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '7px', fontSize: '13px', fontWeight: 600, color: '#fff',
  fontFamily: 'monospace', outline: 'none',
}
const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: 'var(--cyan-deep)', color: '#fff',
  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
}
const btnOutline: React.CSSProperties = {
  padding: '8px 18px', background: 'transparent',
  border: '1.5px solid var(--border-md)', color: 'var(--slate)',
  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
}
