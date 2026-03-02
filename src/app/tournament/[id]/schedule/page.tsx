import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ScheduleClient from './ScheduleClient'

export default async function SchedulePage({
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
    .select('*, results(*, player:players(*))')
    .eq('tournament_id', id)
    .order('round_number')
    .order('table_number')

  return (
    <ScheduleClient
      tournament={tournament}
      players={players ?? []}
      tables={tables ?? []}
    />
  )
}
