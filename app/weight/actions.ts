'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logBodyWeight(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const weight_kg = parseFloat(formData.get('weight_kg') as string)
  const logged_at = (formData.get('logged_at') as string)?.trim()
  const note = (formData.get('note') as string)?.trim() || null

  if (!weight_kg || weight_kg <= 0) return { error: 'Invalid weight' }
  if (!logged_at) return { error: 'Date required' }

  const { error } = await supabase
    .from('body_weight_logs')
    .upsert(
      { user_id: user.id, weight_kg, logged_at, note },
      { onConflict: 'user_id,logged_at' },
    )

  if (error) return { error: error.message }

  revalidatePath('/weight')
  return { ok: true }
}

export async function deleteBodyWeightLog(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('body_weight_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/weight')
  return { ok: true }
}
