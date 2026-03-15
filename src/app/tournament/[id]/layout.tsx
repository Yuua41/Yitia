import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TournamentLayoutClient from './TournamentLayoutClient'

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode
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
    .eq('owner_id', user.id)
    .single()

  if (!tournament) redirect('/dashboard')

  return (
    <TournamentLayoutClient tournament={tournament}>
      {children}
    </TournamentLayoutClient>
  )
}
