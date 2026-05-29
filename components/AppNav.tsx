'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function AppNav() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!user) return null

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-md mx-auto overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex items-center gap-4 px-4 py-3 whitespace-nowrap">
          <Link href="/" className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
            Home
          </Link>
          <Link href="/exercises" className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
            Exercises
          </Link>
          <Link href="/programs" className="text-sm font-bold text-gray-900 hover:text-purple-600 transition-colors">
            Programs
          </Link>
          <Link href="/stats" className="text-sm font-bold text-gray-900 hover:text-green-600 transition-colors">
            Stats
          </Link>
          <Link href="/weight" className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
            ⚖️ Weight
          </Link>
          <Link href="/goals" className="text-sm font-bold text-gray-900 hover:text-orange-500 transition-colors">
            🎯 Goals
          </Link>
          <Link href="/feed" className="text-sm font-bold text-gray-900 hover:text-pink-500 transition-colors">
            💬 Feed
          </Link>
          <Link href="/trophies" className="text-sm font-bold text-gray-900 hover:text-yellow-600 transition-colors">
            🏆 Trophies
          </Link>
          <Link href="/settings" className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
            Settings
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-sm font-bold text-gray-400 hover:text-gray-700 transition-colors">
              Admin
            </Link>
          )}
          <button onClick={handleSignOut} className="text-sm font-bold text-gray-500 hover:text-black transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  )
}
