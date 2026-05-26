'use server'

import { createClient } from '@/lib/supabase/server'
import { runTrophyEngine } from '@/lib/trophies/engine'
import { revalidatePath } from 'next/cache'

export async function forceEvaluateTrophies() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Guard: only the admin email
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email !== adminEmail) {
    return { error: 'Forbidden' }
  }

  // Get the most recent completed workout id (or a dummy id — engine uses userId primarily)
  const { data: latest } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .not('total_duration_mins', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const workoutId = latest?.id ?? ''

  try {
    const newTrophies = await runTrophyEngine(supabase, user.id, workoutId)
    revalidatePath('/admin')
    revalidatePath('/trophies')
    return { success: true, count: newTrophies.length, trophies: newTrophies.map(t => `${t.trophy.id} (${t.tierLabel})`) }
  } catch (err: any) {
    return { error: err?.message ?? 'Engine error' }
  }
}

export async function clearTrophies() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email !== adminEmail) return { error: 'Forbidden' }

  const { error } = await supabase.from('user_trophies').delete().eq('user_id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/trophies')
  return { success: true }
}
