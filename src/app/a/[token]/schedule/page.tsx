import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ScheduleClient from '@/app/tournament/[id]/schedule/ScheduleClient'

export default async function AdminSchedulePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createServiceClient()

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
    .select('*, results(*, player:players(*))')
    .eq('tournament_id', tournament.id)
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
