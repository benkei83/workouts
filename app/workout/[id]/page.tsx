import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// ==========================================
// 1. SERVER ACTIONS
// ==========================================
async function finishWorkout() {
  'use server'
  // Later, we will add math here to calculate total_duration_mins
  // and trigger the Progression Engine to level up your weights/speeds.
  redirect('/')
}

// ==========================================
// 2. DYNAMIC PAGE COMPONENT
// ==========================================
// Note: In Next.js 15+, dynamic params must be treated as a Promise
export default async function ActiveWorkoutPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Security Check: Are they logged in?
  if (!user) {
    redirect('/sign-in')
  }

  // 2. Data Fetch: Get the specific workout bucket
  const { data: workout, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id) // Crucial: Ensure they own it
    .single()

  // 3. Error Handling: If the ID is fake or belongs to someone else, kick them out
  if (error || !workout) {
    redirect('/')
  }

  // Format the start time for the header
  const startTime = new Date(workout.created_at).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      
      {/* Sticky Workout Header */}
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 truncate">{workout.title}</h1>
          <p className="text-gray-500 text-xs font-medium">Started at {startTime}</p>
        </div>
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
      </header>

      <div className="px-6 mt-6 space-y-6">
        
        {/* THIS IS WHERE THE LIVE LOGS WILL APPEAR */}
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50/50">
          <p className="text-gray-400 font-medium text-sm">Your canvas is empty.</p>
          <p className="text-gray-400 text-xs mt-1">Add a module below to start training.</p>
        </div>

        {/* The Module Add Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-white border border-gray-200 text-gray-900 font-bold py-4 rounded-xl shadow-sm hover:border-black transition-colors flex flex-col items-center gap-2">
            <span className="text-2xl">🏃</span>
            <span className="text-sm">Add Cardio</span>
          </button>
          
          <button className="bg-white border border-gray-200 text-gray-900 font-bold py-4 rounded-xl shadow-sm hover:border-black transition-colors flex flex-col items-center gap-2">
            <span className="text-2xl">🏋️</span>
            <span className="text-sm">Add Strength</span>
          </button>
        </div>
      </div>

      {/* Floating Finish Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
        <form action={finishWorkout} className="max-w-md mx-auto">
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