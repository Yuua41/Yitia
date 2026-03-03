import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage({
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

  const { data: templates } = await supabase
    .from('rule_templates')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <SettingsClient
      tournament={tournament}
      players={players ?? []}
      templates={templates ?? []}
    />
  )
}
