import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PlayerClient from './PlayerClient'

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('token', token)
    .single()

  if (!player) notFound()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', player.tournament_id)
    .single()

  if (!tournament) notFound()

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('seat_order')

  const { data: tables } = await supabase
    .from('tables')
    .select('*, results(*, player:players(name, seat_order))')
    .eq('tournament_id', tournament.id)
    .order('round_number')
    .order('table_number')

  return (
    <PlayerClient
      player={player}
      tournament={tournament}
      players={players ?? []}
      tables={tables ?? []}
    />
  )
}
