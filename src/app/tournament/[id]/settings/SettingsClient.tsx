'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, Player, RuleTemplate, RuleConfig } from '@/types'
import { nanoid } from 'nanoid'

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
  })
  const [uma14, setUma14] = useState(tournament.config.uma[0])
  const [uma23, setUma23] = useState(tournament.config.uma[1])
  const [playerText, setPlayerText] = useState(players.map(p => p.name).join('\n'))
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [settingsMode, setSettingsMode] = useState<'basic' | 'advanced'>('basic')
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)

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

    const newNames = playerText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean)
    if (newNames.length < 4) return alert('プレイヤーを4名以上入力してください')

    setSaving(true)

    const finalConfig: RuleConfig = { ...config, uma: getUma(), umaMode: settingsMode === 'basic' ? 'simple' : 'detail' }
    const roundsChanged = numRounds !== tournament.num_rounds

    // 参加者の変更チェック
    let adjustedNames = [...newNames]
    while (adjustedNames.length % 4 !== 0) {
      adjustedNames.push(`黒子${4 - (adjustedNames.length % 4)}`)
    }
    const playersChanged = adjustedNames.length !== players.length ||
      adjustedNames.some((n, i) => n !== players[i]?.name)

    const needsRegeneration = roundsChanged || playersChanged

    if (needsRegeneration) {
      const msg = roundsChanged && playersChanged
        ? '試合数と参加者が変更されました。卓組が再生成されます。入力済みのスコアは削除されます。よろしいですか？'
        : roundsChanged
          ? '試合数を変更すると卓組が再生成されます。入力済みのスコアは削除されます。よろしいですか？'
          : '参加者が変更されました。卓組が再生成されます。入力済みのスコアは削除されます。よろしいですか？'
      const ok = confirm(msg)
      if (!ok) {
        if (roundsChanged) setNumRounds(tournament.num_rounds)
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

    if (needsRegeneration) {
      // 既存のtables/resultsを削除
      const { data: existingTables } = await supabase
        .from('tables')
        .select('id')
        .eq('tournament_id', tournament.id)

      if (existingTables && existingTables.length > 0) {
        await supabase.from('results').delete().in('table_id', existingTables.map(t => t.id))
      }
      await supabase.from('tables').delete().eq('tournament_id', tournament.id)

      let playerIds: string[]

      if (playersChanged) {
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
          setSaving(false)
          return
        }
        playerIds = newPlayers.map(p => p.id)
      } else {
        playerIds = players.map(p => p.id)
      }

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

  const statusLabel = () => {
    if (tournament.status === 'ongoing') return { text: '進行中', color: 'var(--cyan-deep)', bg: 'var(--cyan-pale)' }
    if (tournament.status === 'finished') return { text: '完了', color: '#15803d', bg: '#f0fdf4' }
    return { text: '開催前', color: '#a16830', bg: 'var(--gold-pale)' }
  }

  const s = statusLabel()

  return (
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
        height: '52px', background: '#fff', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'serif', fontSize: '16px', fontWeight: 700, letterSpacing: '0.04em' }}>設定</span>
          <span style={{
            display: 'inline-flex', padding: '2px 8px', borderRadius: '5px',
            fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
            background: s.bg, color: s.color,
          }}>{s.text}</span>
        </div>
        {isDraft && (
          <button onClick={() => handleSave('dashboard')} disabled={saving} style={{
            padding: '6px 16px', background: saving ? 'var(--mist)' : 'var(--cyan-deep)', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}>{saving ? '保存中...' : '保存'}</button>
        )}
      </div>

      {/* コンテンツ */}
      <div className="settings-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '600px' }}>
          <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800, marginBottom: '3px' }}>設定</div>
          <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '20px' }}>
            {isDraft ? '大会開始前にルールや基本情報を設定できます' : 'この大会の設定内容です'}
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
          <div style={{
            background: '#fff', border: '1.5px solid var(--border)',
            borderRadius: '12px', padding: '18px', marginBottom: '14px',
            boxShadow: '0 1px 8px rgba(15,21,32,0.05)',
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
                <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', lineHeight: 1.65 }} placeholder="ルールの補足、チョンボ罰則など..." />
              ) : (
                <div style={displayStyle}>{notes || '—'}</div>
              )}
            </div>
          </div>

          {/* 参加者カード */}
          <div style={{
            background: '#fff', border: '1.5px solid var(--border)',
            borderRadius: '12px', padding: '18px', marginBottom: '14px',
            boxShadow: '0 1px 8px rgba(15,21,32,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mist)' }}>参加者</div>
              {isDraft && <div style={{ fontSize: '10px', color: 'var(--mist)' }}>改行、または半角カンマ区切り</div>}
            </div>
            {isDraft ? (
              <>
                <textarea
                  value={playerText}
                  onChange={e => setPlayerText(e.target.value)}
                  style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', lineHeight: 1.65 }}
                  placeholder={"プレイヤー名A\nプレイヤー名B\nプレイヤー名C\n（改行または半角カンマ区切り）"}
                />
                <div style={{ fontSize: '11px', color: 'var(--mist)', marginTop: '3px' }}>
                  {playerText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length} 名入力中
                  {playerText.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length % 4 !== 0 && (
                    <span style={{ color: 'var(--slate)', marginLeft: '6px' }}>
                      (4の倍数になるよう黒子が追加されます)
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {players.map(p => (
                  <span key={p.id} onClick={() => router.push(`/tournament/${tournament.id}/players`)} style={{
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
            )}
          </div>

          {/* 基本/詳細トグル */}
          {isDraft && (
            <div style={{ display: 'flex', background: 'var(--paper)', borderRadius: '9px', padding: '3px', gap: '2px', marginBottom: '14px', border: '1.5px solid var(--border)' }}>
              {(['basic', 'advanced'] as const).map(m => (
                <button key={m} onClick={() => setSettingsMode(m)} style={{
                  flex: 1, padding: '7px 4px', fontSize: '12px', fontWeight: 600,
                  border: 'none', borderRadius: '7px', cursor: 'pointer',
                  background: settingsMode === m ? '#fff' : 'transparent',
                  color: settingsMode === m ? 'var(--ink)' : 'var(--mist)',
                  boxShadow: settingsMode === m ? '0 1px 4px rgba(15,21,32,0.08)' : 'none',
                  transition: 'all 0.13s',
                }}>
                  {m === 'basic' ? '基本設定' : '詳細設定'}
                </button>
              ))}
            </div>
          )}

          {/* ルール設定カード */}
          <div style={{
            background: 'var(--navy)', borderRadius: '12px', padding: '18px', marginBottom: '14px',
            color: '#fff',
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
                      <div key={label} style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '5px 4px' }}>
                        <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: label === '3位' || label === '4位' ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>{val}</div>
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
              )
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                {['1位','2位','3位','4位'].map((l, i) => (
                  <div key={l} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '5px 4px' }}>
                    <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: i >= 2 ? '#fca5a5' : 'rgba(255,255,255,0.7)' }}>
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

            {/* 詳細設定: 丸め方式 */}
            {(settingsMode === 'advanced' || !isDraft) && (
              <>
                <div style={cfgLabelStyle}>丸め方式</div>
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
          </div>

          {/* ステータスセクション */}
          {isDraft && (
            <div style={{
              background: '#fff', border: '1.5px solid var(--border)',
              borderRadius: '12px', padding: '18px', marginBottom: '14px',
              boxShadow: '0 1px 8px rgba(15,21,32,0.05)',
            }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: '14px' }}>ステータス</div>
              <div style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '14px', lineHeight: 1.6 }}>
                大会を開始すると、選手がスコアを入力できるようになります。<br />
                開始後はルール設定の変更ができなくなります。
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => handleSave()} disabled={saving} style={{
                  flex: 1, padding: '12px', background: saving ? 'var(--mist)' : 'var(--cyan-deep)',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                }}>{saving ? '更新中...' : '更新'}</button>
                <button onClick={handleStart} disabled={starting} style={{
                  flex: 1, padding: '12px', background: starting ? 'var(--mist)' : 'linear-gradient(135deg, #AD82A9, #7B4F79)',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 12px rgba(173,130,169,0.3)',
                }}>{starting ? '開始中...' : '大会を開始する'}</button>
              </div>
            </div>
          )}

          {/* 進行中: 終了ボタン */}
          {tournament.status === 'ongoing' && (
            <div style={{
              background: '#fff', border: '1.5px solid var(--border)',
              borderRadius: '12px', padding: '18px', marginBottom: '14px',
              boxShadow: '0 1px 8px rgba(15,21,32,0.05)',
            }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mist)', marginBottom: '14px' }}>ステータス</div>
              <div style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '14px', lineHeight: 1.6 }}>
                この大会は進行中のため、設定の変更はできません。<br />
                全ての対局が終了したら大会を終了してください。
              </div>

              {/* プレイヤー入力制御 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', marginBottom: '12px',
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

              <button onClick={handleFinish} disabled={finishing} style={{
                width: '100%', padding: '12px',
                background: finishing ? 'var(--mist)' : 'var(--navy)',
                color: '#fff', border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              }}>{finishing ? '終了処理中...' : '大会を終了する'}</button>
            </div>
          )}

          {/* 終了済み通知 */}
          {tournament.status === 'finished' && (
            <div style={{
              background: '#f0fdf4', border: '1.5px solid rgba(21,128,61,0.2)',
              borderRadius: '12px', padding: '14px 18px',
              fontSize: '12px', color: '#15803d', lineHeight: 1.6,
            }}>
              この大会は終了しています。
            </div>
          )}
        </div>
      </div>
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
const displayStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--paper)',
  border: '1.5px solid var(--border)', borderRadius: '9px',
  fontSize: '13px', color: 'var(--slate)', fontFamily: 'inherit',
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
const cfgSuffixStyle: React.CSSProperties = {
  padding: '7px 8px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)', borderLeft: 'none',
  borderRadius: '0 7px 7px 0', fontSize: '12px',
  color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace',
}
const cfgDisplayStyle: React.CSSProperties = {
  padding: '7px 10px', background: 'rgba(255,255,255,0.05)',
  borderRadius: '7px', fontSize: '13px', fontWeight: 600,
  color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace',
}
