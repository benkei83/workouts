import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ExerciseManager from '@/components/ExerciseManager'

// ==========================================
// 1. THE STATIC SHELL (Instant Load)
// ==========================================
export default function ExercisesPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24 relative">
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-7 z-10 shadow-sm flex items-center gap-3">
        <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500">
          ←
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Exercise Dictionary</h1>
      </header>
      
      <div className="p-6">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-pulse">
            <div className="h-16 w-16 bg-gray-200 rounded-full"></div>
            <p className="text-gray-400 font-medium">Loading exercises...</p>
          </div>
        }>
          <ExerciseDataLoader />
        </Suspense>
      </div>
    </main>
  )
}

// ==========================================
// 2. THE SECURE DATA LOADER
// ==========================================
async function ExerciseDataLoader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/sign-in')

  // Fetch this user's exercises
  const { data: exercises } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', user.id)
    .order('name')

  // Fetch your active target settings
  const { data: settings } = await supabase
    .from('user_exercise_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const safeExercises = exercises || []
  const safeSettings = settings || []

  // Merge them together so the UI knows your current targets
  const exercisesWithSettings = safeExercises.map(ex => {
    const setting = safeSettings.find(s => s.exercise_id === ex.id)
    return {
      ...ex,
      settings: setting || null
    }
  })

  return <ExerciseManager initialExercises={exercisesWithSettings} />
}