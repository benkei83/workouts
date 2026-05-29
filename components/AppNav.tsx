'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const PRIMARY = [
  { href: '/exercises', label: 'Exercises' },
  { href: '/stats',     label: 'Stats' },
  { href: '/feed',      label: '💬 Feed' },
]

const MORE = [
  { href: '/programs', label: 'Programs' },
  { href: '/weight',   label: '⚖️ Weight' },
  { href: '/goals',    label: '🎯 Goals' },
  { href: '/trophies', label: '🏆 Trophies' },
  { href: '/settings', label: 'Settings' },
]

export default function AppNav() {
  const [user, setUser] = useState<User | null>(null)
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setActiveWorkoutId(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Re-check active workout on every navigation so starting/finishing updates immediately
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('workouts')
      .select('id')
      .eq('user_id', user.id)
      .is('total_duration_mins', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setActiveWorkoutId(data?.id ?? null))
  }, [pathname, user])

  // Clear immediately when the workout-finished event fires
  useEffect(() => {
    if (!activeWorkoutId) return
    const handler = () => setActiveWorkoutId(null)
    window.addEventListener(`workout-finished:${activeWorkoutId}`, handler)
    return () => window.removeEventListener(`workout-finished:${activeWorkoutId}`, handler)
  }, [activeWorkoutId])

  // Close menu on navigation
  useEffect(() => { setOpen(false) }, [pathname])

  if (!user) return null

  async function handleSignOut() {
    setOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const moreItems = isAdmin ? [...MORE, { href: '/admin', label: 'Admin' }] : MORE

  // Show the workout button when there's an active workout and we're not already on that screen
  const showWorkout = !!activeWorkoutId && !pathname.startsWith('/workout/')

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  const moreIsActive = moreItems.some(item => isActive(item.href))

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
      )}

      {/* More menu */}
      {open && (
        <div className="fixed bottom-14 left-0 right-0 z-40">
          <div className="max-w-md mx-auto px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              {moreItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-5 py-4 text-sm font-bold border-b border-gray-100 last:border-0 transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center px-5 py-4 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-md mx-auto flex px-4 pb-px">

          {/* First slot: active workout button OR home */}
          {showWorkout ? (
            <Link
              href={`/workout/${activeWorkoutId}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              Workout
            </Link>
          ) : (
            <Link
              href="/"
              className={`flex-1 flex items-center justify-center py-3 text-xs font-bold transition-colors ${
                isActive('/') && !open ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Home
            </Link>
          )}

          {PRIMARY.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex items-center justify-center py-3 text-xs font-bold transition-colors ${
                isActive(item.href) && !open ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          ))}

          <button
            onClick={() => setOpen(prev => !prev)}
            className={`flex-1 flex items-center justify-center py-3 text-xs font-bold transition-colors ${
              open || moreIsActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            ≡ More
          </button>
        </div>
      </nav>
    </>
  )
}
