'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, Player, RuleTemplate, RuleConfig } from '@/types'
import HeaderIcons from '@/components/ui/HeaderIcons'
import { TutorialProvider, HelpButton } from '@/components/tutorial/TutorialOverlay'
import { settingsSteps, settingsOngoingSteps } from '@/components/tutorial/steps'
import TournamentStatusActions from '@/components/ui/TournamentStatusActions'

interface Props {
  tournament: Tournament
  players: Player[]
  templates: RuleTemplate[]
}

export default function SettingsClient({ tournament, players, templates }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isDraft = tournament.status === 'draft'

  const [name, setName] = useState(tournament.name)
  const [heldOn, setHeldOn] = useState(tournament.held_on ?? '')
  const [notes, setNotes] = useState(tournament.notes ?? '')
  const [numRounds, setNumRounds] = useState(tournament.num_rounds)
  const [config, setConfig] = useState<RuleConfig>({
    ...tournament.config,
    rounding: tournament.config.rounding ?? 'none',
    allowPlayerEntry: tournament.config.allowPlayerEntry ?? true,
    byeMode: tournament.config.byeMode ?? 'dummy',
  })
  const [uma14, setUma14] = useState(tournament.config.uma[0])
  const [uma23, setUma23] = useState(tournament.config.uma[1])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [settingsMode, setSettingsMode] = useState<'basic' | 'advanced'>('basic')
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // 未保存状態の追跡
  const initialSnapshot = useRef(JSON.stringify({ name: tournament.name, heldOn: tournament.held_on ?? '', notes: tournament.notes ?? '', numRounds: tournament.num_rounds, config: tournament.config }))
  const isDirty = isDraft && JSON.stringify({ name, heldOn, notes, numRounds, config: { ...config, uma: getUma() } }) !== initialSnapshot.current

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // レイアウト側にdirty状態を通知
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('settings-dirty', { detail: isDirty }))
    return () => { window.dispatchEvent(new CustomEvent('settings-dirty', { detail: false })) }
  }, [isDirty])

  function applyTemplate(tplId: string) {
    setSelectedTemplate(tplId)
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return
    setConfig({ ...tpl.config, rounding: tpl.config.rounding ?? 'none' })
    setUma14(tpl.config.uma[0])
    setUma23(tpl.config.uma[1])
  }

  function getUma(): [number, number, number, number] {
    if (settingsMode === 'basic') {
      return [uma14, uma23, -uma23, -uma14]
    }
    return config.uma
  }

  async function handleSave(redirect?: 'dashboard') {
    if (!name.trim()) return alert('大会名を入力してください')

    setSaving(true)

    const finalConfig: RuleConfig = { ...config, uma: getUma(), umaMode: settingsMode === 'basic' ? 'simple' : 'detail' }
    const roundsChanged = numRounds !== tournament.num_rounds

    if (roundsChanged) {
      const ok = confirm('試合数を変更すると卓組が再生成されます。入力済みのスコアは削除されます。よろしいですか？')
      if (!ok) {
        setNumRounds(tournament.num_rounds)
        setSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from('tournaments')
      .update({
        name: name.trim(),
        held_on: heldOn || null,
        notes: notes || null,
        num_rounds: numRounds,
        config: finalConfig,
      })
      .eq('id', tournament.id)

    if (error) {
      alert('保存に失敗しました: ' + error.message)
      setSaving(false)
      return
    }

    if (roundsChanged) {
      // 既存のtables/resultsを削除
      const { data: existingTables } = await supabase
        .from('tables')
        .select('id')
        .eq('tournament_id', tournament.id)

      if (existingTables && existingTables.length > 0) {
        await supabase.from('results').delete().in('table_id', existingTables.map(t => t.id))
      }
      await supabase.from('tables').delete().eq('tournament_id', tournament.id)

      const playerIds = players.map(p => p.id)

      // 卓組を再生成
      const { generateSchedule } = await import('@/lib/mahjong/calculator')
      const schedule = generateSchedule(playerIds, numRounds)

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

    setSaving(false)
    if (redirect === 'dashboard') {
      router.push('/dashboard')
    } else if (roundsChanged) {
      // 試合数変更時はキャッシュをクリアするためフルリロード
      window.location.reload()
    } else {
      router.refresh()
    }
  }

  async function handleFinish() {
    const ok = confirm('大会を終了しますか？終了後はスコア入力が締め切られます。')
    if (!ok) return
    setFinishing(true)
    const { error } = await supabase
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', tournament.id)
    if (error) {
      alert('終了に失敗しました: ' + error.message)
      setFinishing(false)
      return
    }
    router.refresh()
  }

  async function handleStart() {
    const ok = confirm('大会を開始しますか？開始後はルール設定の変更ができなくなります。')
    if (!ok) return
    setStarting(true)

    const { error } = await supabase
      .from('tournaments')
      .update({ status: 'ongoing' })
      .eq('id', tournament.id)

    if (error) {
      alert('開始に失敗しました: ' + error.message)
      setStarting(false)
      return
    }

    router.refresh()
  }

  return (
    <TutorialProvider>
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .settings-header { padding: 0 26px; }
        .settings-content { padding: 24px 26px; }
        @media (max-width: 768px) {
          .settings-header { padding: 0 16px !important; }
          .settings-content { padding: 16px !important; }
        }
      `}</style>
      {/* ヘッダー */}
      <div className="settings-header" style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpButton steps={tournament.status === 'ongoing' ? settingsOngoingSteps : settingsSteps} pageKey="settings" />
          <HeaderIcons />
        </div>
      </div>

      {/* コンテンツ */}
      <div className="settings-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '600px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "var(--font-jp, 'M PLUS 1p'), sans-serif", fontSize: '20px', fontWeight: 800 }}>大会設定</div>
          </div>

          {/* テンプレート選択 */}
          {isDraft && templates.length > 0 && (
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

          {/* 大会情報カード */}
          <div data-tutorial="basic-info" style={{
            background: 'var(--card-bg)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid var(--card-border)',
            borderRadius: '12px', padding: '18px', marginBottom: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: '14px' }}>大会情報</div>

            <div style={{ marginBottom: '13px' }}>
              <label style={labelStyle}>大会名</label>
              {isDraft ? (
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="例：第1回 春季大会" />
              ) : (
                <div style={displayStyle}>{name}</div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '13px' }}>
              <div>
                <label style={labelStyle}>開催日</label>
                {isDraft ? (
                  <input type="date" value={heldOn} onChange={e => setHeldOn(e.target.value)} style={inputStyle} />
                ) : (
                  <div style={displayStyle}>{heldOn || '日程未定'}</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>試合数</label>
                {isDraft ? (
                  <select value={numRounds} onChange={e => setNumRounds(+e.target.value)} style={inputStyle}>
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}回戦</option>)}
                  </select>
                ) : (
                  <div style={displayStyle}>{numRounds}回戦</div>
                )}
              </div>
            </div>

            <div>
              <label style={labelStyle}>備考</label>
              {isDraft ? (
                <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', lineHeight: 1.65 }} placeholder="ルールの補足など..." />
              ) : (
                <div style={displayStyle}>{notes || '—'}</div>
              )}
            </div>
          </div>

          {/* 参加者カード */}
          <div data-tutorial="players-input" style={{
            background: 'var(--card-bg)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid var(--card-border)',
            borderRadius: '12px', padding: '18px', marginBottom: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mist)' }}>参加者</div>
              <div style={{ fontSize: '10px', color: 'var(--mist)' }}>{players.length}名</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {players.map(p => (
                <span key={p.id} onClick={() => router.push(`/tournament/${tournament.id}/players#player-${p.id}`)} style={{
                  padding: '4px 10px', background: 'var(--paper)',
                  border: '1px solid var(--border)', borderRadius: '6px',
                  fontSize: '12px', color: 'var(--cyan-deep)', cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--cyan-pale)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper)')}
                >{p.name}</span>
              ))}
            </div>
            {isDraft && (
              <button
                onClick={() => router.push(`/tournament/${tournament.id}/players`)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  width: '100%', marginTop: '12px', padding: '10px',
                  background: 'transparent', border: '1.5px dashed var(--border-md)',
                  borderRadius: '9px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600, color: 'var(--mist)',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan-deep)'; e.currentTarget.style.borderColor = 'rgba(0,240,255,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--mist)'; e.currentTarget.style.borderColor = 'var(--border-md)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                参加者を追加
              </button>
            )}
          </div>

          {/* 基本/詳細トグル */}
          {isDraft && (
            <div data-tutorial="settings-mode-toggle" style={{ display: 'flex', background: 'var(--paper)', borderRadius: '9px', padding: '3px', gap: '2px', marginBottom: '14px', border: '1.5px solid var(--border)' }}>
              {(['basic', 'advanced'] as const).map(m => (
                <button key={m} onClick={() => setSettingsMode(m)} style={{
                  flex: 1, padding: '7px 4px', fontSize: '12px', fontWeight: 600,
                  border: 'none', borderRadius: '7px', cursor: 'pointer',
                  background: settingsMode === m ? 'var(--cyan-pale)' : 'transparent',
                  color: settingsMode === m ? 'var(--ink)' : 'var(--mist)',
                  boxShadow: settingsMode === m ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.13s',
                }}>
                  {m === 'basic' ? '基本設定' : '詳細設定'}
                </button>
              ))}
            </div>
          )}

          {/* ルール設定カード */}
          <div data-tutorial="rule-settings" style={{
            background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid var(--card-border)',
            borderRadius: '12px', padding: '18px', marginBottom: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <div style={cfgLabelStyle}>持ち点 / 返し</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
              <div>
                <div style={cfgItemLabelStyle}>持ち点</div>
                {isDraft ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="number" value={config.startingPoints / 1000} onChange={e => setConfig(c => ({ ...c, startingPoints: +e.target.value * 1000 }))} style={cfgInputStyle} />
                    <span style={cfgSuffixStyle}>,000</span>
                  </div>
                ) : (
                  <div style={cfgDisplayStyle}>{(config.startingPoints / 1000).toLocaleString()},000</div>
                )}
              </div>
              <div>
                <div style={cfgItemLabelStyle}>返し</div>
                {isDraft ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="number" value={config.returnPoints / 1000} onChange={e => setConfig(c => ({ ...c, returnPoints: +e.target.value * 1000 }))} style={cfgInputStyle} />
                    <span style={cfgSuffixStyle}>,000</span>
                  </div>
                ) : (
                  <div style={cfgDisplayStyle}>{(config.returnPoints / 1000).toLocaleString()},000</div>
                )}
              </div>
            </div>

            <div style={cfgLabelStyle}>ウマ設定</div>
            {isDraft ? (
              settingsMode === 'basic' ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    <div>
                      <div style={cfgItemLabelStyle}>1位・4位ウマ</div>
                      <input type="number" value={uma14} onChange={e => setUma14(+e.target.value)} style={cfgInputStyle} />
                    </div>
                    <div>
                      <div style={cfgItemLabelStyle}>2位・3位ウマ</div>
                      <input type="number" value={uma23} onChange={e => setUma23(+e.target.value)} style={cfgInputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {[
                      { label: '1位', val: `+${uma14}` },
                      { label: '2位', val: `+${uma23}` },
                      { label: '3位', val: `−${uma23}` },
                      { label: '4位', val: `−${uma14}` },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ flex: 1, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 4px' }}>
                        <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--mist)', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: label === '3位' || label === '4位' ? 'var(--red)' : 'var(--ink)' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '4px' }}>
                    {['1位','2位','3位','4位'].map(l => (
                      <div key={l} style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--mist)', textAlign: 'center' }}>{l}</div>
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
                        style={{ ...cfgInputStyle, textAlign: 'center', color: i >= 2 ? 'var(--red)' : 'var(--ink)' }} />
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                {['1位','2位','3位','4位'].map((l, i) => (
                  <div key={l} style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 4px' }}>
                    <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--mist)', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: i >= 2 ? 'var(--red)' : 'var(--ink)' }}>
                      {config.uma[i] >= 0 ? '+' : ''}{config.uma[i]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={cfgLabelStyle}>同点処理 / 席順</div>
            {isDraft ? (
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
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={cfgDisplayStyle}>{config.tieBreak === 'kamicha' ? '上家取り' : '同点分け'}</div>
                <div style={cfgDisplayStyle}>{config.seatMode === 'random' ? '席ランダム' : '席順なし'}</div>
              </div>
            )}

            {/* 詳細設定: ポイント切り上げ */}
            {(settingsMode === 'advanced' || !isDraft) && (
              <>
                <div style={cfgLabelStyle}>ポイント切り上げ</div>
                {isDraft ? (
                  <ToggleGroup
                    options={[
                      { value: 'none', label: '小数点以下反映' },
                      { value: 'round', label: '四捨五入' },
                      { value: 'round_half_up', label: '五捨六入' },
                    ]}
                    value={config.rounding ?? 'none'}
                    onChange={v => setConfig(c => ({ ...c, rounding: v as 'none' | 'round' | 'round_half_up' }))}
                  />
                ) : (
                  <div style={cfgDisplayStyle}>
                    {config.rounding === 'round_half_up' ? '五捨六入' : config.rounding === 'round' ? '四捨五入' : '小数点以下反映'}
                  </div>
                )}
              </>
            )}

            <div style={cfgLabelStyle}>人数調整</div>
            {isDraft ? (
              <ToggleGroup
                options={[
                  { value: 'dummy', label: '黒子で補完' },
                  { value: 'bye', label: '休みを許容' },
                ]}
                value={config.byeMode ?? 'dummy'}
                onChange={v => setConfig(c => ({ ...c, byeMode: v as 'dummy' | 'bye' }))}
              />
            ) : (
              <div style={cfgDisplayStyle}>
                {(config.byeMode ?? 'dummy') === 'dummy' ? '黒子で補完' : '休みを許容'}
              </div>
            )}
          </div>

          {/* 終了済み通知 */}
          {tournament.status === 'finished' && (
            <div style={{
              background: 'var(--cyan-pale)', border: '1.5px solid var(--nav-active-border)',
              borderRadius: '12px', padding: '14px 18px',
              fontSize: '12px', color: 'var(--cyan-deep)', lineHeight: 1.6,
            }}>
              この大会は終了しています。
            </div>
          )}

          {/* 進行中: プレイヤー入力制御 */}
          {tournament.status === 'ongoing' && (
            <div data-tutorial="player-entry-toggle" style={{
              background: 'var(--card-bg)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid var(--card-border)',
              borderRadius: '12px', padding: '18px', marginBottom: '14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: '14px' }}>プレイヤー設定</div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--paper)', border: '1.5px solid var(--border)',
                borderRadius: '9px',
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>プレイヤーのスコア入力</div>
                  <div style={{ fontSize: '10px', color: 'var(--mist)' }}>
                    {config.allowPlayerEntry !== false ? 'プレイヤーが自分でスコアを入力できます' : '管理者のみがスコアを入力できます'}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const newVal = config.allowPlayerEntry === false ? true : false
                    setConfig(c => ({ ...c, allowPlayerEntry: newVal }))
                    await supabase.from('tournaments').update({
                      config: { ...config, allowPlayerEntry: newVal },
                    }).eq('id', tournament.id)
                  }}
                  style={{
                    position: 'relative', width: '44px', height: '24px', flexShrink: 0,
                    border: 'none', borderRadius: '12px', cursor: 'pointer',
                    background: config.allowPlayerEntry !== false ? 'var(--cyan-deep)' : 'var(--mist)',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: config.allowPlayerEntry !== false ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 下部固定ステータスバー */}
      {isDraft && (
        <div className="settings-header" style={{
          borderTop: '1px solid var(--header-border)',
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}>
          <div style={{ maxWidth: '600px', padding: '14px 0', display: 'flex', gap: '10px' }}>
            <button onClick={() => handleSave()} disabled={saving} style={{
              flex: 1, padding: '10px', background: 'transparent', color: 'var(--cyan-deep)',
              border: '1.5px solid var(--cyan-deep)', borderRadius: '8px',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button data-tutorial="start-button" onClick={handleStart} disabled={starting} style={{
              flex: 1, padding: '10px', background: 'transparent', color: 'var(--gold)',
              border: '1.5px solid var(--gold)', borderRadius: '8px',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              opacity: starting ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              {starting ? '開始中...' : '大会を開始する'}
            </button>
          </div>
        </div>
      )}

      {tournament.status === 'ongoing' && (
        <div className="settings-header" style={{
          borderTop: '1px solid var(--header-border)',
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}>
          <div style={{ maxWidth: '600px', padding: '14px 0', display: 'flex', gap: '10px' }}>
            <button onClick={handleFinish} disabled={finishing} style={{
              flex: 1, padding: '10px', background: 'transparent', color: 'var(--gold)',
              border: '1.5px solid var(--gold)', borderRadius: '8px',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              opacity: finishing ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
              {finishing ? '終了処理中...' : '大会を終了する'}
            </button>
          </div>
        </div>
      )}
    </div>
    </TutorialProvider>
  )
}

function ToggleGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', padding: '2px', gap: '2px' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '6px 4px', fontSize: '11px', fontWeight: 600,
          border: 'none', borderRadius: '5px', cursor: 'pointer',
          background: value === o.value ? 'var(--cyan-deep)' : 'transparent',
          color: value === o.value ? '#fff' : 'var(--mist)',
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
const displayStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--paper)',
  border: '1.5px solid var(--border)', borderRadius: '9px',
  fontSize: '13px', color: 'var(--slate)', fontFamily: 'inherit',
}
const cfgLabelStyle: React.CSSProperties = {
  fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em',
  textTransform: 'uppercase', color: 'var(--mist)',
  marginBottom: '10px', marginTop: '14px',
}
const cfgItemLabelStyle: React.CSSProperties = {
  fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.15em',
  textTransform: 'uppercase', color: 'var(--mist)', marginBottom: '4px',
}
const cfgInputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  background: 'var(--surface)', border: '1px solid var(--border-md)',
  borderRadius: '7px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)',
  fontFamily: 'monospace', outline: 'none',
}
const cfgSuffixStyle: React.CSSProperties = {
  padding: '7px 8px', background: 'var(--surface)',
  border: '1px solid var(--border-md)', borderLeft: 'none',
  borderRadius: '0 7px 7px 0', fontSize: '12px',
  color: 'var(--mist)', fontFamily: 'monospace',
}
const cfgDisplayStyle: React.CSSProperties = {
  padding: '7px 10px', background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '7px', fontSize: '13px', fontWeight: 600,
  color: 'var(--slate)', fontFamily: 'monospace',
}
