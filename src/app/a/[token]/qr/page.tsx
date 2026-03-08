import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import QRClient from '@/components/tournament/QRClient'

export default async function AdminQRPage({
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

  return <QRClient tournament={tournament} players={players ?? []} adminToken={token} />
}
