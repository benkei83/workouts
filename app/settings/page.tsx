import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SettingsForm from '@/components/SettingsForm'
import { DEFAULT_USER_SETTINGS } from '@/lib/settings'
import type { UserSettings } from '@/lib/settings'

export default function SettingsPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-16">
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <p className="text-gray-400 text-sm animate-pulse">Loading settings…</p>
        </div>
      }>
        <SettingsContent />
      </Suspense>
    </main>
  )
}

async function SettingsContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // Fetch settings row — fall back to defaults if no row exists yet
  let settings: UserSettings = { ...DEFAULT_USER_SETTINGS }
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('screen_name, show_trophy_toasts, rest_timer_default_secs, vibrate_on_rest_complete, sound_on_rest_complete, height_cm')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data) {
      settings = {
        screen_name:              data.screen_name              ?? null,
        show_trophy_toasts:       data.show_trophy_toasts       ?? DEFAULT_USER_SETTINGS.show_trophy_toasts,
        rest_timer_default_secs:  data.rest_timer_default_secs  ?? DEFAULT_USER_SETTINGS.rest_timer_default_secs,
        vibrate_on_rest_complete: data.vibrate_on_rest_complete ?? DEFAULT_USER_SETTINGS.vibrate_on_rest_complete,
        sound_on_rest_complete:   data.sound_on_rest_complete   ?? DEFAULT_USER_SETTINGS.sound_on_rest_complete,
        height_cm:                data.height_cm != null ? Number(data.height_cm) : null,
      }
    }
  } catch { /* table not migrated yet — use defaults */ }

  return (
    <>
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Settings & Profile</h1>
          <p className="text-xs text-gray-400 font-medium">{user.email}</p>
        </div>
      </header>

      <div className="px-4 pt-6">
        <SettingsForm settings={settings} />
      </div>
    </>
  )
}
