import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { InteractiveCanvas } from './InteractiveCanvas'
import { finishWorkout } from '../actions'
import WorkoutOptions from '@/components/WorkoutOptions'

// ==========================================
// THE PAGE SHELL
// ==========================================
export default function ActiveWorkoutPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-12 relative">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center pt-32 space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded-lg"></div>
          <div className="h-32 w-full bg-gray-200 rounded-2xl mx-6"></div>
          <p className="text-gray-400 font-medium mt-4">Loading your canvas...</p>
        </div>
      }>
        <WorkoutDataLoader params={params} />
      </Suspense>
    </main>
  )
}

// ==========================================
// THE SECURE DATA LOADER
// ==========================================
async function WorkoutDataLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: workout, error } = await supabase
    .from('workouts')
    .select(`
      *, 
      running_logs(*, running_legs(*)), 
      strength_logs(*, strength_sets(*, exercises(name)))
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !workout) redirect('/')

  const isFinished = workout.total_duration_mins !== null

// 1. Fetch the raw exercises
  const { data: allExercisesRaw } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('category', 'strength')
    .order('name')

  // 2. Fetch the FULL settings object
  const { data: userSettings } = await supabase
    .from('user_exercise_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  // 3. Merge them together
  const allExercises = (allExercisesRaw || []).map(ex => {
    const setting = (userSettings || []).find(s => s.exercise_id === ex.id)
    return {
      ...ex,
      settings: setting || null,
      increment_step: setting?.increment_step || 2.5
    }
  })

  // 4. Fetch programs with full workout/exercise tree
  const { data: programs } = await supabase
    .from('programs')
    .select(`
      *,
      program_workouts (
        *,
        program_exercises (
          *,
          exercises ( id, name )
        )
      )
    `)
    .order('name')

  // 5. Fetch user's active program (for rotation tracking)
  const { data: activeProgram } = await supabase
    .from('user_active_programs')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // 6. Fetch superset templates (for SupersetForm load/save)
  const { data: supersetTemplates } = await supabase
    .from('superset_templates')
    .select(`
      id, name,
      superset_template_exercises ( sort_order, exercise_id, exercises(id, name) )
    `)
    .eq('user_id', user.id)
    .order('name')

  // 7. Build per-exercise "last session" map from the 20 most recent completed workouts
  const { data: recentWorkouts } = await supabase
    .from('workouts')
    .select('id, created_at')
    .eq('user_id', user.id)
    .not('total_duration_mins', 'is', null)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const recentWorkoutIds = (recentWorkouts || []).map(w => w.id)
  const lastSessionMap: Record<string, { date: string; sets: { weight: number; reps: number }[] }> = {}

  if (recentWorkoutIds.length > 0) {
    const { data: recentLogs } = await supabase
      .from('strength_logs')
      .select('workout_id, strength_sets(exercise_id, actual_weight, actual_reps, set_number)')
      .in('workout_id', recentWorkoutIds)

    // Walk workouts newest-first; record the FIRST occurrence of each exercise
    for (const w of (recentWorkouts || [])) {
      const logsForWorkout = (recentLogs || []).filter(l => l.workout_id === w.id)
      const seenExIds = new Set<string>()

      for (const log of logsForWorkout) {
        for (const s of ((log.strength_sets as any[]) || [])) {
          if (s.exercise_id && !seenExIds.has(s.exercise_id)) {
            seenExIds.add(s.exercise_id)
          }
        }
      }

      for (const exId of seenExIds) {
        if (!lastSessionMap[exId]) {
          const allSets = logsForWorkout
            .flatMap(l => ((l.strength_sets as any[]) || []).filter((s: any) => s.exercise_id === exId))
            .sort((a: any, b: any) => a.set_number - b.set_number)
          lastSessionMap[exId] = {
            date: w.created_at,
            sets: allSets.map((s: any) => ({
              weight: s.actual_weight ?? 0,
              reps: s.actual_reps ?? 0,
            })),
          }
        }
      }
    }
  }

  // Merge lastSession into allExercises
  const allExercisesWithHistory = allExercises.map(ex => ({
    ...ex,
    lastSession: lastSessionMap[ex.id] ?? null,
  }))

  const dateObj = new Date(workout.created_at)
  const timeString = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  
  const subtitle = isFinished ? `${dateString} • ${workout.total_duration_mins} mins` : `Started at ${timeString}`

  return (
    <>
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500">
            {isFinished ? '←' : '✕'}
          </Link>
          <div className="min-w-0 pr-2">
            <h1 className="text-lg font-extrabold text-gray-900 truncate">{workout.title}</h1>
            <p className="text-gray-500 text-xs font-medium">{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isFinished && (
            <form action={finishWorkout}>
              <input type="hidden" name="workout_id" value={workout.id} />
              <button 
                type="submit" 
                className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors shadow-sm active:scale-95"
              >
                Finish
              </button>
            </form>
          )}
          <WorkoutOptions workoutId={workout.id} currentTitle={workout.title} />
        </div>
      </header>

      <div className="px-6 mt-6">
        <InteractiveCanvas
          workoutId={workout.id}
          initialRunningLogs={workout.running_logs || []}
          initialStrengthLogs={workout.strength_logs || []}
          exercises={allExercisesWithHistory}
          programs={(programs as any) || []}
          activeProgram={activeProgram || null}
          supersetTemplates={(supersetTemplates as any) || []}
        />
      </div>
    </>
  )
}