import type { Result, RuleConfig, Table, Player } from '@/types'

export interface StandingEntry {
  player: Player
  roundPoints: (number | null)[]
  base: number
  total: number
  rank: number
  isTied: boolean
}

/**
 * 全体成績を計算して順位付きで返す。
 * @param players    プレイヤー一覧
 * @param tables     確定済みテーブル一覧（is_validated フィルタ済みを渡すこと）
 * @param numRounds  総ラウンド数
 * @param bonuses    調整ポイントの上書き（未指定の場合は player.bonus を使用）
 */
export function calcStandings(
  players: Player[],
  tables: Table[],
  numRounds: number,
  bonuses: Record<string, number> = {}
): StandingEntry[] {
  const standings = players.map(player => {
    const roundPoints: (number | null)[] = Array(numRounds).fill(null)
    tables.forEach(table => {
      const results = (table as any).results as Result[]
      const result = results?.find(r => r.player_id === player.id)
      if (result && table.is_validated) {
        roundPoints[table.round_number - 1] = result.point
      }
    })
    const base = roundPoints.reduce<number>((sum, p) => sum + (p ?? 0), 0)
    const adj = player.id in bonuses ? bonuses[player.id] : (player.bonus ?? 0)
    const total = Math.round((base + adj) * 10) / 10
    return { player, roundPoints, base, total }
  })

  return standings
    .sort((a, b) => b.total - a.total)
    .map((s, _i, arr) => {
      const rank = arr.filter(x => x.total > s.total).length + 1
      const isTied = arr.filter(x => x.total === s.total).length > 1
      return { ...s, rank, isTied }
    })
}

function roundPoint(value: number, mode: RuleConfig['rounding'] = 'none'): number {
  if (mode === 'none' || !mode) {
    // 小数点以下反映: 小数1桁まで保持
    return Math.round(value * 10) / 10
  }
  if (mode === 'round_half_up') {
    // 五捨六入: 小数点以下が.5なら切り捨て、.6以上なら切り上げ（整数に丸める）
    const abs = Math.abs(value)
    const frac = abs - Math.floor(abs)
    const rounded = frac > 0.5 ? Math.ceil(abs) : Math.floor(abs)
    return value >= 0 ? rounded : -rounded
  }
  // 四捨五入: 小数点以下を標準の丸めで整数に
  return Math.round(value)
}

export function calcTableResults(
  results: Result[],
  config: RuleConfig
): Result[] {
  const { returnPoints, startingPoints, uma, tieBreak, rounding = 'none' } = config
  const oka = ((returnPoints - startingPoints) * 4) / 1000

  if (tieBreak === 'kamicha') {
    const sorted = [...results]
      .sort((a, b) =>
        b.score !== a.score ? b.score - a.score : a.seat_index - b.seat_index
      )
    return results.map((res) => {
      const idx = sorted.findIndex((s) => s.player_id === res.player_id)
      const rank = idx + 1
      let point = (res.score - returnPoints) / 1000 + uma[idx]
      if (rank === 1) point += oka
      return { ...res, rank, point: roundPoint(point, rounding) }
    })
  }

  // split (同点分け)
  const final = results.map((r) => ({ ...r, rank: 0, point: 0 }))
  const scoreGroups: Record<number, string[]> = {}
  results.forEach((r) => {
    if (!scoreGroups[r.score]) scoreGroups[r.score] = []
    scoreGroups[r.score].push(r.player_id)
  })

  const sortedScores = Object.keys(scoreGroups)
    .map(Number)
    .sort((a, b) => b - a)

  let curRank = 1
  sortedScores.forEach((score) => {
    const pIds = scoreGroups[score]
    const count = pIds.length
    let totalUma = 0
    let totalRank = 0
    for (let i = 0; i < count; i++) {
      totalUma += uma[curRank - 1 + i]
      totalRank += curRank + i
    }
    const avgUma = totalUma / count
    const avgRank = totalRank / count
    const splitOka = curRank === 1 ? oka / count : 0

    pIds.forEach((id) => {
      const idx = final.findIndex((f) => f.player_id === id)
      final[idx].rank = avgRank
      final[idx].point = roundPoint(
        (score - returnPoints) / 1000 + avgUma + splitOka,
        rounding
      )
    })
    curRank += count
  })

  return final
}

export function generateSchedule(
  playerIds: string[],
  numRounds: number
): { roundNumber: number; tables: { playerIds: string[]; seatOrder: string[] }[] }[] {
  const seatCounts: Record<string, number[]> = {}
  playerIds.forEach((id) => (seatCounts[id] = [0, 0, 0, 0]))

  // 対戦回数を追跡: matchCounts[a][b] = aとbが同卓になった回数
  const matchCounts: Record<string, Record<string, number>> = {}
  playerIds.forEach((id) => {
    matchCounts[id] = {}
    playerIds.forEach((id2) => { if (id !== id2) matchCounts[id][id2] = 0 })
  })

  const numTables = Math.floor(playerIds.length / 4)
  const rounds = []

  for (let r = 1; r <= numRounds; r++) {
    // 複数のランダムシャッフルを試行し、対戦重複コストが最小のものを選択
    const attempts = Math.min(200, 20 + playerIds.length * 5)
    let bestGrouping: string[][] = []
    let bestCost = Infinity

    for (let a = 0; a < attempts; a++) {
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
      const groups: string[][] = []
      for (let t = 0; t < numTables; t++) {
        groups.push(shuffled.slice(t * 4, (t + 1) * 4))
      }
      // 対戦重複コスト: 同卓ペアの過去対戦回数の二乗和
      let cost = 0
      for (const g of groups) {
        for (let i = 0; i < g.length; i++) {
          for (let j = i + 1; j < g.length; j++) {
            const c = matchCounts[g[i]][g[j]]
            cost += c * c
          }
        }
      }
      if (cost < bestCost) {
        bestCost = cost
        bestGrouping = groups
      }
      if (cost === 0) break // 完全に重複なし → これ以上探す必要なし
    }

    // 選ばれたグルーピングで席順最適化 & 対戦回数を更新
    const tables = []
    for (const group of bestGrouping) {
      const best = findBestSeatAssignment(group, seatCounts)
      best.forEach((id, idx) => seatCounts[id][idx]++)
      // 対戦回数を更新
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          matchCounts[group[i]][group[j]]++
          matchCounts[group[j]][group[i]]++
        }
      }
      tables.push({ playerIds: group, seatOrder: best })
    }
    rounds.push({ roundNumber: r, tables })
  }
  return rounds
}

function getPermutations(arr: string[]): string[][] {
  if (arr.length <= 1) return [arr]
  const perms: string[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = getPermutations([...arr.slice(0, i), ...arr.slice(i + 1)])
    for (const p of rest) perms.push([arr[i], ...p])
  }
  return perms
}

function findBestSeatAssignment(
  playerIds: string[],
  history: Record<string, number[]>
): string[] {
  const perms = getPermutations(playerIds)
  let minCost = Infinity
  let best = playerIds
  for (const p of perms) {
    let cost = 0
    for (let i = 0; i < 4; i++) {
      const count = history[p[i]] ? history[p[i]][i] : 0
      cost += count * count
    }
    if (cost < minCost) {
      minCost = cost
      best = p
    }
  }
  return best
}

export function formatPoint(v: number): string {
  const abs = Math.abs(v)
  const formatted = abs.toFixed(1)
  if (formatted === '0.0') return `±${formatted}`
  return `${v < 0 ? '▲' : '+'}${formatted}`
}
