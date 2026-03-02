import type { Result, RuleConfig, Table } from '@/types'

export function calcTableResults(
  results: Result[],
  config: RuleConfig
): Result[] {
  const { returnPoints, startingPoints, uma, tieBreak } = config
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
      return { ...res, rank, point: Math.round(point * 10) / 10 }
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
      final[idx].point =
        Math.round(
          ((score - returnPoints) / 1000 + avgUma + splitOka) * 10
        ) / 10
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

  const rounds = []
  for (let r = 1; r <= numRounds; r++) {
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
    const numTables = Math.floor(shuffled.length / 4)
    const tables = []

    for (let t = 0; t < numTables; t++) {
      const group = shuffled.slice(t * 4, (t + 1) * 4)
      const best = findBestSeatAssignment(group, seatCounts)
      best.forEach((id, idx) => seatCounts[id][idx]++)
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
  return `${v < 0 ? '▲' : '+'}${Math.abs(v).toFixed(1)}`
}
