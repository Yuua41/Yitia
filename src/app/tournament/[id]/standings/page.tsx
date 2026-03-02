import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StandingsClient from './StandingsClient'

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single()

  if (!tournament) redirect('/dashboard')

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', id)
    .order('seat_order')

  const { data: tables } = await supabase
    .from('tables')
    .select('*, results(*)')
    .eq('tournament_id', id)
    .eq('is_validated', true)
    .order('round_number')

  return (
    <StandingsClient
      tournament={tournament}
      players={players ?? []}
      tables={tables ?? []}
    />
  )
}
