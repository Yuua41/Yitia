import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import StandingsClient from '@/components/tournament/StandingsClient'

export default async function AdminStandingsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('admin_token', token)
    .single()

  if (!tournament) notFound()

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('seat_order')

  const { data: tables } = await supabase
    .from('tables')
    .select('*, results(*)')
    .eq('tournament_id', tournament.id)
    .eq('is_validated', true)
    .order('round_number')

  return (
    <StandingsClient
      tournament={tournament}
      players={players ?? []}
      tables={tables ?? []}
      isOwner={false}
    />
  )
}
