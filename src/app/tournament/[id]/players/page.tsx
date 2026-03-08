import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlayersClient from './PlayersClient'

export default async function PlayersPage({
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

  return (
    <PlayersClient
      tournament={tournament}
      players={players ?? []}
    />
  )
}
