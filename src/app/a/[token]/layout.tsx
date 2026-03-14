import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AdminLayoutClient from './AdminLayoutClient'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
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

  return (
    <AdminLayoutClient tournament={tournament} token={token}>
      {children}
    </AdminLayoutClient>
  )
}
