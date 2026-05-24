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
  // Reduced bottom padding (pb-24 -> pb-12) since the sticky button is gone
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

  const { data: allExercises } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('category', 'strength')
    .order('name')

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
        
        {/* THE NEW HEADER ACTIONS GROUP */}
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
          exercises={allExercises || []}
        />
      </div>
    </>
  )
}