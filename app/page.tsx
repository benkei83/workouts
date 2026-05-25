import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

// ==========================================
// 1. SERVER ACTIONS
// ==========================================
async function startWorkout() {
  'use server'
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 

  // 1. Check if an active workout already exists
  const { data: existingWorkout } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .is('total_duration_mins', null)
    .single()

  if (existingWorkout) {
    revalidatePath('/')
    redirect(`/workout/${existingWorkout.id}`)
  }

  // 2. Generate a dynamic Strava-style title
  const now = new Date()
  const hour = now.getHours()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = days[now.getDay()]

  let timeOfDay = 'Night'
  if (hour >= 4 && hour < 12) timeOfDay = 'Morning'
  else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon'
  else if (hour >= 17 && hour < 22) timeOfDay = 'Evening'

  const dynamicTitle = `${dayName} ${timeOfDay} Workout`

  // 3. Create a new empty workout bucket with the smart title
  const { data: workout, error } = await supabase
    .from('workouts')
    .insert({ 
      user_id: user.id, 
      title: dynamicTitle
    })
    .select()
    .single()

  if (error || !workout) {
    console.error("Failed to start workout:", error)
    return
  }

  revalidatePath('/')
  redirect(`/workout/${workout.id}`)
}

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/')
}

// ==========================================
// 2. STATIC PAGE SHELL
// ==========================================
export default function HomePage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <p className="text-gray-500 font-medium animate-pulse">Loading dashboard...</p>
        </div>
      }>
        <Dashboard />
      </Suspense>
    </main>
  )
}

// ==========================================
// 3. DYNAMIC DASHBOARD 
// ==========================================
async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
<header className="bg-white px-6 py-5 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Fitness Engine</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {user ? `Logged in as ${user.email}` : 'Not logged in'}
          </p>
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <Link href="/exercises" className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
              Exercises
            </Link>
            <Link href="/programs" className="text-sm font-bold text-gray-900 hover:text-purple-600 transition-colors">
              Programs
            </Link>
            <form action={signOut}>
              <button className="text-sm font-bold text-gray-500 hover:text-black transition-colors">
                Sign Out
              </button>
            </form>
          </div>
        ) : (
          <Link href="/sign-in" className="bg-black text-white text-sm font-bold py-2 px-4 rounded-full hover:bg-gray-800 transition-colors">
            Sign In
          </Link>
        )}
      </header>
      
      <div className="px-6 mt-6 space-y-8">
        {!user ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl flex items-center gap-2">
            <span>⚠️</span> You must be signed in to log a workout.
          </div>
        ) : (
          <Suspense fallback={<div className="animate-pulse h-32 bg-gray-200 rounded-2xl"></div>}>
            <WorkoutManager userId={user.id} />
          </Suspense>
        )}
      </div>
    </>
  )
}

// ==========================================
// 4. DATABASE FETCHING & ROUTING COMPONENT
// ==========================================
async function WorkoutManager({ userId }: { userId: string }) {
  const supabase = await createClient()
  
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select(`
      id,
      title,
      created_at,
      total_duration_mins,
      running_logs ( id, distance_km ),
      strength_logs ( id )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return <p className="text-red-500 text-center py-4">Error loading workouts.</p>

  const safeWorkouts = workouts || []
  
  const activeWorkout = safeWorkouts.find(w => w.total_duration_mins === null)
  const historyWorkouts = safeWorkouts.filter(w => w.total_duration_mins !== null)

  return (
    <>
      {/* THE HERO SECTION */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {activeWorkout ? (
          <>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Session in progress</h2>
                <p className="text-sm text-gray-500">You have an active workout running.</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse mt-2"></div>
            </div>
            <Link href={`/workout/${activeWorkout.id}`} className="w-full bg-green-600 text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-green-700 active:scale-[0.98] transition-all shadow-md">
              Resume Workout
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Ready to train?</h2>
            <p className="text-sm text-gray-500 mb-6">Start an empty session to log strength, 4x4 intervals, or a hybrid workout.</p>
            <form action={startWorkout}>
              <button type="submit" className="w-full bg-black text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all shadow-md">
                <span className="text-xl">+</span> Start Empty Workout
              </button>
            </form>
          </>
        )}
      </section>

      {/* THE HISTORY SECTION */}
      <section>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Training History</h3>
        {historyWorkouts.length === 0 ? (
          <p className="text-gray-500 text-center py-8 bg-white rounded-2xl border border-dashed border-gray-300">No history found. Time to break a sweat!</p>
        ) : (
          <ul className="space-y-3">
            {historyWorkouts.map((workout) => {
              const date = new Date(workout.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              const hasRunning = workout.running_logs && workout.running_logs.length > 0
              const hasStrength = workout.strength_logs && workout.strength_logs.length > 0
              
              let tags = []
              if (hasRunning) tags.push('🏃 Cardio')
              if (hasStrength) tags.push('🏋️ Strength')
              if (!hasRunning && !hasStrength) tags.push('📝 Empty Session')

              // THE FIX: The <li> is now the parent, and the <Link> is the child!
              return (
                <li key={workout.id}>
                  <Link href={`/workout/${workout.id}`} className="block bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-gray-300 transition-colors group cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="block text-gray-900 font-bold">{workout.title}</strong>
                      <span className="text-xs text-gray-400">{date}</span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {tags.map(tag => (
                        <span key={tag} className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{workout.total_duration_mins} mins</p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}