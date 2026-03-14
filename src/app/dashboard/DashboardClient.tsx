'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcTableResults } from '@/lib/mahjong/calculator'
import type { Tournament, RuleConfig, Result } from '@/types'
import { nanoid } from 'nanoid'
import HeaderIcons from '@/components/ui/HeaderIcons'

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
  const [seeding, setSeeding] = useState(false)
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
      await supabase.from('results').delete().in('table_id', tableIds)
    }

    await supabase.from('tables').delete().eq('tournament_id', deleteTarget.id)
    await supabase.from('players').delete().eq('tournament_id', deleteTarget.id)
    await supabase.from('tournaments').delete().eq('id', deleteTarget.id)

    setDeleting(false)
    setDeleteTarget(null)
    router.refresh()
  }

  async function handleCreateSample() {
    setSeeding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSeeding(false); return }

    const sampleConfig: RuleConfig = {
      startingPoints: 25000,
      returnPoints: 30000,
      uma: [30, 10, -10, -30],
      tieBreak: 'split',
      seatMode: 'random',
      umaMode: 'simple',
      rounding: 'none',
    }

    // --- 完了済み大会 (32人 8回戦) ---
    const { data: t1, error: e1 } = await supabase
      .from('tournaments')
      .insert({
        owner_id: user.id,
        name: '第42回 春季麻雀大会',
        held_on: '2026-03-01',
        notes: 'サンプル。25000点持ち30000点返し、ウマ20-10。同点は分け。',
        num_rounds: 8,
        config: sampleConfig,
        admin_token: nanoid(12),
        status: 'finished',
      })
      .select()
      .single()

    if (e1 || !t1) {
      showToast('作成失敗: ' + e1?.message)
      setSeeding(false)
      return
    }

    const names32 = [
      '佐藤', '田中', '鈴木', '山田', '渡辺', '高橋', '伊藤', '中村',
      '小林', '加藤', '吉田', '山口', '松本', '井上', '木村', '清水',
      '林', '斎藤', '山本', '池田', '橋本', '阿部', '石川', '前田',
      '藤田', '小川', '岡田', '後藤', '長谷川', '石井', '村上', '近藤',
    ]
    const { data: p1 } = await supabase
      .from('players')
      .insert(names32.map((n, i) => ({
        tournament_id: t1.id, name: n, seat_order: i, token: nanoid(12),
        bonus: i === 2 ? -20 : i === 15 ? -10 : 0,
      })))
      .select()

    if (!p1) { setSeeding(false); return }

    // 32人を8卓に割り振り × 8ラウンド
    // 各卓合計 = 100000、リアルなバリエーション（大勝ち→大負け等ジグザグ）
    const rounds1: { r: number; t: number; pi: number[]; sc: number[] }[] = [
      // R1 — 初戦：波乱含み
      { r:1, t:1, pi:[0,1,2,3],     sc:[12000,35200,39800,13000] },
      { r:1, t:2, pi:[4,5,6,7],     sc:[42100,18900,15000,24000] },
      { r:1, t:3, pi:[8,9,10,11],   sc:[9500,38000,22500,30000] },
      { r:1, t:4, pi:[12,13,14,15], sc:[31500,15500,41000,12000] },
      { r:1, t:5, pi:[16,17,18,19], sc:[24000,29000,11000,36000] },
      { r:1, t:6, pi:[20,21,22,23], sc:[16000,43800,26200,14000] },
      { r:1, t:7, pi:[24,25,26,27], sc:[33100,10000,24900,32000] },
      { r:1, t:8, pi:[28,29,30,31], sc:[22000,37000,13000,28000] },
      // R2 — 巻き返しラウンド
      { r:2, t:1, pi:[0,5,10,15],   sc:[41000,14000,31000,14000] },
      { r:2, t:2, pi:[1,4,11,14],   sc:[18000,26700,42300,13000] },
      { r:2, t:3, pi:[2,7,8,13],    sc:[15500,35000,28000,21500] },
      { r:2, t:4, pi:[3,6,9,12],    sc:[28000,20000,27000,25000] },
      { r:2, t:5, pi:[16,21,26,31], sc:[15000,25500,39500,20000] },
      { r:2, t:6, pi:[17,20,27,30], sc:[33000,16000,22000,29000] },
      { r:2, t:7, pi:[18,23,24,29], sc:[14000,46000,18000,22000] },
      { r:2, t:8, pi:[19,22,25,28], sc:[30000,15000,25000,30000] },
      // R3 — 混戦：同点あり
      { r:3, t:1, pi:[0,7,9,14],    sc:[15000,21000,37500,26500] },
      { r:3, t:2, pi:[1,6,8,15],    sc:[25000,25000,25000,25000] },
      { r:3, t:3, pi:[2,5,11,12],   sc:[43200,13000,24800,19000] },
      { r:3, t:4, pi:[3,4,10,13],   sc:[14000,34000,22000,30000] },
      { r:3, t:5, pi:[16,23,25,30], sc:[28500,21000,28500,22000] },
      { r:3, t:6, pi:[17,22,24,31], sc:[14000,27000,19000,40000] },
      { r:3, t:7, pi:[18,21,27,28], sc:[32000,16000,28000,24000] },
      { r:3, t:8, pi:[19,20,26,29], sc:[18000,36000,26000,20000] },
      // R4 — 上位陣が沈む展開
      { r:4, t:1, pi:[0,6,11,13],   sc:[28000,16000,28000,28000] },
      { r:4, t:2, pi:[1,7,10,12],   sc:[14000,27500,38500,20000] },
      { r:4, t:3, pi:[2,4,9,15],    sc:[25000,25000,25000,25000] },
      { r:4, t:4, pi:[3,5,8,14],    sc:[14000,44000,18000,24000] },
      { r:4, t:5, pi:[16,22,27,29], sc:[35000,16000,28000,21000] },
      { r:4, t:6, pi:[17,23,26,28], sc:[17000,23000,31000,29000] },
      { r:4, t:7, pi:[18,20,25,31], sc:[13000,42500,25500,19000] },
      { r:4, t:8, pi:[19,21,24,30], sc:[27000,20000,29000,24000] },
      // R5 — 中盤：逆転の兆し
      { r:5, t:1, pi:[0,4,8,12],    sc:[39000,15000,26000,20000] },
      { r:5, t:2, pi:[1,5,9,13],    sc:[16000,33500,28500,22000] },
      { r:5, t:3, pi:[2,6,10,14],   sc:[19000,27000,27000,27000] },
      { r:5, t:4, pi:[3,7,11,15],   sc:[13000,23000,47000,17000] },
      { r:5, t:5, pi:[16,20,24,28], sc:[30000,18000,30000,22000] },
      { r:5, t:6, pi:[17,21,25,29], sc:[25500,17000,36500,21000] },
      { r:5, t:7, pi:[18,22,26,30], sc:[41000,13000,18000,28000] },
      { r:5, t:8, pi:[19,23,27,31], sc:[25000,25000,25000,25000] },
      // R6 — 終盤戦突入
      { r:6, t:1, pi:[0,13,22,31],  sc:[16000,23000,32000,29000] },
      { r:6, t:2, pi:[1,12,23,30],  sc:[44500,13000,24500,18000] },
      { r:6, t:3, pi:[2,15,20,29],  sc:[28000,19000,28000,25000] },
      { r:6, t:4, pi:[3,14,21,28],  sc:[15000,37000,27000,21000] },
      { r:6, t:5, pi:[4,9,18,27],   sc:[35500,16000,22000,26500] },
      { r:6, t:6, pi:[5,8,19,26],   sc:[15000,40000,25000,20000] },
      { r:6, t:7, pi:[6,11,16,25],  sc:[28000,19000,29000,24000] },
      { r:6, t:8, pi:[7,10,17,24],  sc:[12000,43000,27000,18000] },
      // R7 — 最終盤：大荒れ
      { r:7, t:1, pi:[0,14,19,28],  sc:[22000,26000,26000,26000] },
      { r:7, t:2, pi:[1,15,18,29],  sc:[14000,36000,28000,22000] },
      { r:7, t:3, pi:[2,12,17,30],  sc:[41500,13000,26500,19000] },
      { r:7, t:4, pi:[3,13,16,31],  sc:[30000,16000,30000,24000] },
      { r:7, t:5, pi:[4,10,23,26],  sc:[17000,38000,25000,20000] },
      { r:7, t:6, pi:[5,11,22,27],  sc:[33000,16000,23000,28000] },
      { r:7, t:7, pi:[6,8,21,24],   sc:[14000,45000,23000,18000] },
      { r:7, t:8, pi:[7,9,20,25],   sc:[28500,19000,28500,24000] },
      // R8 — 最終戦：逆転劇
      { r:8, t:1, pi:[0,11,17,26],  sc:[34000,16000,28000,22000] },
      { r:8, t:2, pi:[1,10,16,27],  sc:[15000,39500,25500,20000] },
      { r:8, t:3, pi:[2,9,19,24],   sc:[30000,17000,23000,30000] },
      { r:8, t:4, pi:[3,8,18,25],   sc:[42000,14000,26000,18000] },
      { r:8, t:5, pi:[4,15,21,30],  sc:[27000,19000,27000,27000] },
      { r:8, t:6, pi:[5,14,20,31],  sc:[15000,37500,26500,21000] },
      { r:8, t:7, pi:[6,13,23,28],  sc:[33000,16000,29000,22000] },
      { r:8, t:8, pi:[7,12,22,29],  sc:[46000,13000,24000,17000] },
    ]

    for (const rd of rounds1) {
      const { data: tbl } = await supabase
        .from('tables')
        .insert({ tournament_id: t1.id, round_number: rd.r, table_number: rd.t, has_extra_sticks: false, is_validated: true })
        .select().single()
      if (!tbl) continue

      const initResults = rd.pi.map((pIdx, seat) => ({
        table_id: tbl.id, player_id: p1[pIdx].id, seat_index: seat,
        score: rd.sc[seat], point: 0, rank: 0, is_negative_mode: false,
      }))
      const { data: rows } = await supabase.from('results').insert(initResults).select()
      if (!rows) continue

      const calc = calcTableResults(rows as Result[], sampleConfig)
      for (const c of calc) {
        await supabase.from('results').update({ point: c.point, rank: c.rank }).eq('id', c.id)
      }
    }

    // --- 進行中大会 ---
    const { data: t2 } = await supabase
      .from('tournaments')
      .insert({
        owner_id: user.id,
        name: '月例大会 3月',
        held_on: '2026-03-15',
        notes: null,
        num_rounds: 3,
        config: sampleConfig,
        admin_token: nanoid(12),
        status: 'ongoing',
      })
      .select().single()

    if (t2) {
      const names8 = ['佐藤', '田中', '鈴木', '山田', '渡辺', '高橋', '伊藤', '中村']
      const { data: p2 } = await supabase
        .from('players')
        .insert(names8.map((n, i) => ({
          tournament_id: t2.id, name: n, seat_order: i, token: nanoid(12), bonus: 0,
        })))
        .select()

      if (p2) {
        const rounds2: { r: number; t: number; pi: number[]; sc: number[]; validated: boolean }[] = [
          { r: 1, t: 1, pi: [0,1,2,3], sc: [32000,29000,24000,15000], validated: true },
          { r: 1, t: 2, pi: [4,5,6,7], sc: [36000,28000,21000,15000], validated: true },
          { r: 2, t: 1, pi: [0,5,2,7], sc: [40000,25000,20000,15000], validated: true },
          { r: 2, t: 2, pi: [1,4,3,6], sc: [30000,30000,25000,15000], validated: true },
          { r: 3, t: 1, pi: [0,6,1,7], sc: [25000,25000,25000,25000], validated: false },
          { r: 3, t: 2, pi: [2,4,3,5], sc: [25000,25000,25000,25000], validated: false },
        ]

        for (const rd of rounds2) {
          const { data: tbl } = await supabase
            .from('tables')
            .insert({ tournament_id: t2.id, round_number: rd.r, table_number: rd.t, has_extra_sticks: false, is_validated: rd.validated })
            .select().single()
          if (!tbl) continue

          if (rd.validated) {
            const initResults = rd.pi.map((pIdx, seat) => ({
              table_id: tbl.id, player_id: p2[pIdx].id, seat_index: seat,
              score: rd.sc[seat], point: 0, rank: 0, is_negative_mode: false,
            }))
            const { data: rows } = await supabase.from('results').insert(initResults).select()
            if (!rows) continue
            const calc = calcTableResults(rows as Result[], sampleConfig)
            for (const c of calc) {
              await supabase.from('results').update({ point: c.point, rank: c.rank }).eq('id', c.id)
            }
          } else {
            const initResults = rd.pi.map((pIdx, seat) => ({
              table_id: tbl.id, player_id: p2[pIdx].id, seat_index: seat,
              score: 0, point: 0, rank: 0, is_negative_mode: false,
            }))
            await supabase.from('results').insert(initResults)
          }
        }
      }
    }

    setSeeding(false)
    router.refresh()
  }

  const statusLabel = (t: Tournament) => {
    if (t.status === 'ongoing') return { text: '進行中', color: '#00f0ff', bg: 'rgba(0,240,255,0.15)' }
    if (t.status === 'finished') return { text: '完了', color: '#00ffaa', bg: 'rgba(0,255,170,0.12)' }
    return { text: '下書き', color: 'var(--mist)', bg: 'rgba(0,240,255,0.06)' }
  }

  return (
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
        background: 'rgba(10,14,30,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' }}>大会一覧</span>
        <HeaderIcons />
      </div>

      <div className="dash-content" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--mist)' }}>{tournaments.length}件の大会</div>
          <button
            onClick={handleCreateSample}
            disabled={seeding}
            style={{
              padding: '5px 14px', background: 'transparent',
              border: '1.5px solid var(--cyan-deep)', borderRadius: '7px',
              fontSize: '12px', color: 'var(--cyan-deep)', cursor: 'pointer',
              fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >{seeding ? '作成中...' : 'サンプルデータを作成'}</button>
        </div>

        <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {tournaments.map(t => {
            const s = statusLabel(t)
            return (
              <div key={t.id} style={{
                background: 'rgba(15,21,40,0.6)',
                border: '1px solid rgba(0,240,255,0.10)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '16px', overflow: 'hidden',
                cursor: navigatingId ? 'wait' : 'pointer',
                transition: 'box-shadow 0.2s, background 0.2s, opacity 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                opacity: navigatingId && navigatingId !== t.id ? 0.4 : 1,
                position: 'relative',
              }}
                onMouseEnter={e => { if (!navigatingId) { e.currentTarget.style.boxShadow = '0 8px 36px rgba(0,0,0,0.5), 0 0 20px rgba(0,240,255,0.08)'; e.currentTarget.style.background = 'rgba(15,21,40,0.75)' } }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'; e.currentTarget.style.background = 'rgba(15,21,40,0.6)' }}
              >
                {/* ステータスに応じた上部カラーバー */}
                <div style={{
                  height: '4px',
                  background: t.status === 'ongoing'
                    ? 'linear-gradient(90deg, #00f0ff, #00a0aa)'
                    : t.status === 'finished' ? '#ff00aa' : 'rgba(255,255,255,0.10)',
                }} />

                {/* ローディングシマー */}
                {navigatingId === t.id && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    background: 'rgba(10,14,30,0.85)',
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
                  <div onClick={() => { setNavigatingId(t.id); router.push(`/tournament/${t.id}/schedule`) }}>
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
            onClick={() => setShowForm(true)}
            style={{
              background: 'rgba(15,21,40,0.4)', border: '1px solid rgba(0,240,255,0.10)',
              borderRadius: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              padding: '18px 20px', gap: '14px',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(15,21,40,0.65)'
              e.currentTarget.style.borderColor = 'rgba(0,240,255,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(15,21,40,0.4)'
              e.currentTarget.style.borderColor = 'rgba(0,240,255,0.10)'
            }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              border: '1.5px solid rgba(0,240,255,0.3)',
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
            background: 'rgba(10,14,30,0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(0,240,255,0.12)',
            borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '380px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          }}>
            <div style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--red)' }}>削除</div>
            <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px' }}>大会を削除しますか？</div>
            <div style={{
              fontSize: '13px', color: 'var(--ink)', marginBottom: '6px',
              background: 'rgba(0,240,255,0.04)', padding: '10px 13px', borderRadius: '8px',
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
            background: 'rgba(10,14,30,0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(0,240,255,0.12)',
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
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid rgba(0,240,255,0.12)', background: 'rgba(0,240,255,0.04)', color: 'var(--ink)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
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
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid rgba(0,240,255,0.12)', background: 'rgba(0,240,255,0.04)', color: 'var(--ink)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >＋</button>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[8, 12, 16, 20, 24, 28, 32, 36, 40].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPlayerCount(n)}
                      style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        border: playerCount === n ? '1.5px solid rgba(0,240,255,0.4)' : '1.5px solid rgba(0,240,255,0.12)',
                        background: playerCount === n ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.05)',
                        color: playerCount === n ? '#00f0ff' : 'var(--mist)',
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
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--mist)', marginBottom: '5px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', height: '44px', padding: '0 12px',
  background: 'rgba(0,240,255,0.04)', border: '1.5px solid rgba(0,240,255,0.12)',
  borderRadius: '9px', fontSize: '15px', color: 'var(--ink)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 22px', background: 'linear-gradient(135deg, #00c8d4, #00a0aa)', color: '#fff',
  border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 0 16px rgba(0,240,255,0.2)',
}
const btnOutline: React.CSSProperties = {
  padding: '10px 20px', background: 'rgba(0,240,255,0.04)',
  border: '1.5px solid rgba(0,240,255,0.18)', color: 'var(--slate)',
  borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
}
