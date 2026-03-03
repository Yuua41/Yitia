import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QRClient from './QRClient'

export default async function QRPage({
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

  return <QRClient tournament={tournament} players={players ?? []} adminToken={tournament.admin_token} />
}
