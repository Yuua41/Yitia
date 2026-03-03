export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface RuleConfig {
  startingPoints: number
  returnPoints: number
  uma: [number, number, number, number]
  tieBreak: 'kamicha' | 'split'
  seatMode: 'random' | 'none'
  umaMode: 'simple' | 'detail'
  rounding: 'none' | 'round' | 'round_half_up'  // 小数点以下反映 | 四捨五入 | 五捨六入
}

export interface RuleTemplate {
  id: string
  owner_id: string
  name: string
  config: RuleConfig
  created_at: string
}

export interface Tournament {
  id: string
  owner_id: string
  name: string
  held_on: string | null
  notes: string | null
  num_rounds: number
  config: RuleConfig
  admin_token: string
  status: 'draft' | 'ongoing' | 'finished'
  created_at: string
  players?: Player[]
  tables?: Table[]
}

export interface Player {
  id: string
  tournament_id: string
  name: string
  seat_order: number
  token: string
  bonus: number
  created_at: string
}

export interface Table {
  id: string
  tournament_id: string
  round_number: number
  table_number: number
  has_extra_sticks: boolean
  is_validated: boolean
  created_at: string
  results?: Result[]
}

export interface Result {
  id: string
  table_id: string
  player_id: string
  seat_index: number
  score: number
  point: number
  rank: number
  is_negative_mode: boolean
  updated_at: string
  player?: Player
}

export interface Standing {
  player: Player
  rank: number
  totalPoints: number
  basePoints: number
  totalScore: number
  averageRank: number
  gamesPlayed: number
  roundPoints: (number | null)[]
}
