import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*, players(id)')
    .order('created_at', { ascending: false })

  return (
    <DashboardClient
      tournaments={tournaments ?? []}
    />
  )
}
