'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserSettings } from '@/lib/settings'

export async function updateUserSettings(patch: Partial<UserSettings>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  if (error) return { error: error.message }

  revalidatePath('/settings')
  revalidatePath('/')  // home page reacts to focus_exercise_id changes immediately
  return { ok: true }
}
