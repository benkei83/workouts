import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { InteractiveCanvas } from './InteractiveCanvas'

// ==========================================
// 1. SERVER ACTIONS
// ==========================================
async function finishWorkout() {
  'use server'
  redirect('/')
}

// ==========================================
// 2. THE PAGE SHELL (Instant Load)
// ==========================================
// Notice this is NOT an async function anymore!
export default function ActiveWorkoutPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center pt-32 space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded-lg"></div>
          <div className="h-32 w-full bg-gray-200 rounded-2xl mx-6"></div>
          <p className="text-gray-400 font-medium mt-4">Loading your canvas...</p>
        </div>
      }>
        {/* Pass the unresolved Promise directly down into the secure loader */}
        <WorkoutDataLoader params={params} />
      </Suspense>

      {/* Floating Finish Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pointer-events-none">
        <form action={finishWorkout} className="max-w-md mx-auto pointer-events-auto">
          <button 
            type="submit" 
            className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-lg hover:bg-gray-800 active:scale-[0.98] transition-all"
          >
            Finish Workout
          </button>
        </form>
      </div>

    </main>
  )
}

// ==========================================
// 3. THE SECURE DATA LOADER
// ==========================================
// This is where we safely await both the params and the database queries
async function WorkoutDataLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // Fetch the workout and all nested relational data
  const { data: workout, error } = await supabase
    .from('workouts')
    .select(`
      *, 
      running_logs(*), 
      strength_logs(
        *,
        strength_sets(*, exercises(name))
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !workout) redirect('/')

  // Fetch the global list of exercises for the dropdown
  const { data: allExercises } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('category', 'strength')
    .order('name')

  const startTime = new Date(workout.created_at).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })

  return (
    <>
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 truncate">{workout.title}</h1>
          <p className="text-gray-500 text-xs font-medium">Started at {startTime}</p>
        </div>
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
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