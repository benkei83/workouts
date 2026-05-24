import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ExerciseManager from '@/components/ExerciseManager'

export default async function ExercisesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/sign-in')

  // 1. Fetch all exercises (Global templates + your private ones)
  const { data: exercises } = await supabase
    .from('exercises')
    .select('*')
    .order('name')

  // 2. Fetch your active target settings
  const { data: settings } = await supabase
    .from('user_exercise_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  // 3. Merge them together so the UI knows your current targets
  const safeExercises = exercises || []
  const safeSettings = settings || []

  const exercisesWithSettings = safeExercises.map(ex => {
    const setting = safeSettings.find(s => s.exercise_id === ex.id)
    return {
      ...ex,
      settings: setting || null
    }
  })

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24 relative">
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500">
            ←
          </Link>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Exercise Dictionary</h1>
        </div>
      </header>
      
      <div className="p-6">
        <ExerciseManager initialExercises={exercisesWithSettings} />
      </div>
    </main>
  )
}