export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Suspense } from 'react'
import Link from 'next/link'

// ==========================================
// 1. SERVER ACTIONS
// ==========================================
async function logNewRun(formData: FormData) {
  'use server'
  const supabase = await createClient()
  
  // Verify the user is logged in before saving
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 

  const distance = formData.get('distance')
  const duration = formData.get('duration')
  if (!distance || !duration) return

  // Save the main workout with the user's ID
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .insert({ title: 'Outdoor Run', type: 'running', user_id: user.id })
    .select()
    .single()

  if (workout && !workoutError) {
    // Save the specific running metrics
    await supabase.from('running_logs').insert({
      workout_id: workout.id,
      distance_km: parseFloat(distance as string),
      duration_seconds: parseInt(duration as string) * 60
    })
  }
  
  revalidatePath('/')
}

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/')
}

// ==========================================
// 2. MAIN LAYOUT
// ==========================================
export default async function HomePage() {
  const supabase = await createClient()
  
  // Check if a user session exists when the page loads
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      
      {/* Sticky Header with Dynamic Auth */}
      <header className="bg-white px-6 py-5 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Fitness Tracker</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {user ? `Logged in as ${user.email}` : 'Not logged in'}
          </p>
        </div>
        
        {/* Toggle between Sign Out button and Sign In link */}
        {user ? (
          <form action={signOut}>
            <button className="text-sm font-bold text-gray-500 hover:text-black transition-colors">
              Sign Out
            </button>
          </form>
        ) : (
          <Link href="/login" className="bg-black text-white text-sm font-bold py-2 px-4 rounded-full hover:bg-gray-800 transition-colors">
            Sign In
          </Link>
        )}
      </header>
      
      <div className="px-6 mt-6 space-y-8">
        
        {/* Warning Banner for Logged-Out Users */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl flex items-center gap-2">
            <span>⚠️</span> You must be signed in to log a workout.
          </div>
        )}

        {/* Input Form Section (Disabled if not logged in) */}
        <section className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-opacity ${!user ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            🏃 Log a Run
          </h2>
          <form action={logNewRun} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Distance (km)</label>
                <input 
                  type="number" step="0.1" name="distance" placeholder="5.0" required 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Time (min)</label>
                <input 
                  type="number" name="duration" placeholder="25" required 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black transition-all"
                />
              </div>
            </div>
            <button 
              type="submit" 
              className="w-full bg-black text-white font-bold rounded-xl py-3.5 mt-2 hover:bg-gray-800 active:scale-[0.98] transition-all"
            >
              Save Workout
            </button>
          </form>
        </section>

        {/* History Section */}
        <section>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Recent History</h3>
          <Suspense fallback={<div className="animate-pulse h-20 bg-gray-200 rounded-xl"></div>}>
            <WorkoutList />
          </Suspense>
        </section>
      </div>
    </main>
  )
}

// ==========================================
// 3. DATABASE FETCHING COMPONENT
// ==========================================
async function WorkoutList() {
  const supabase = await createClient()
  
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('*, running_logs(*)')
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="text-red-500 text-center py-4">Error loading workouts.</p>
  }

  if (!workouts || workouts.length === 0) {
    return <p className="text-gray-500 text-center py-8 bg-white rounded-2xl border border-dashed border-gray-300">No workouts yet. Get out there!</p>
  }

  return (
    <ul className="space-y-3">
      {workouts.map((workout) => {
        // Format the database timestamp into a readable date string
        const date = new Date(workout.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        const runLog = workout.running_logs?.[0]

        return (
          <li key={workout.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <strong className="block text-gray-900 font-bold">{workout.title}</strong>
              <span className="text-xs text-gray-400">{date}</span>
            </div>
            {runLog && (
              <div className="text-right">
                <div className="font-bold text-gray-900">
                  {runLog.distance_km} <span className="text-xs text-gray-500 font-normal">km</span>
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(runLog.duration_seconds / 60)} mins
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}