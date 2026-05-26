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
<header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        {/* Top row: title + signed-in email */}
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Fitness Engine</h1>
          {user ? (
            <p className="text-gray-400 text-xs ml-3 truncate max-w-[180px] text-right">{user.email}</p>
          ) : (
            <Link href="/sign-in" className="bg-black text-white text-sm font-bold py-2 px-4 rounded-full hover:bg-gray-800 transition-colors">
              Sign In
            </Link>
          )}
        </div>

        {/* Bottom row: nav + sign out */}
        {user && (
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <Link href="/exercises" className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
              Exercises
            </Link>
            <Link href="/programs" className="text-sm font-bold text-gray-900 hover:text-purple-600 transition-colors">
              Programs
            </Link>
            <Link href="/stats" className="text-sm font-bold text-gray-900 hover:text-green-600 transition-colors">
              Stats
            </Link>
            <form action={signOut}>
              <button className="text-sm font-bold text-gray-500 hover:text-black transition-colors">
                Sign Out
              </button>
            </form>
          </div>
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

  const [{ data: workouts, error }, { data: exerciseSettings }] = await Promise.all([
    supabase
      .from('workouts')
      .select(`
        id,
        title,
        created_at,
        total_duration_mins,
        running_logs ( id, distance_km ),
        strength_logs (
          id,
          strength_sets ( exercise_id, is_pr, actual_reps, actual_weight, exercises ( name ) )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_exercise_settings')
      .select('exercise_id, protocol, target_sets, target_reps, target_reps_min, min_successes, max_failures')
      .eq('user_id', userId)
      .eq('is_active', true),
  ])

  // Build settings lookup for outcome computation
  const settingsMap = Object.fromEntries(
    (exerciseSettings || [])
      .filter(s => s.protocol && s.protocol !== 'manual')
      .map(s => [s.exercise_id, s])
  )

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
            {(() => {
              // ── Pre-pass 1: base outcome per (workout × exercise) ────────────────
              type BaseOutcome = 'success' | 'maintenance' | 'failure'
              const baseOutcomeMap = new Map<string, Map<string, BaseOutcome>>()
              for (const w of historyWorkouts) {
                const allS = (w.strength_logs ?? []).flatMap((l: any) => l.strength_sets ?? [])
                const exReps = new Map<string, number[]>()
                for (const s of allS as any[]) {
                  if (!s.exercise_id) continue
                  if (!exReps.has(s.exercise_id)) exReps.set(s.exercise_id, [])
                  exReps.get(s.exercise_id)!.push(Number(s.actual_reps))
                }
                const exOutcomes = new Map<string, BaseOutcome>()
                for (const [exId, reps] of exReps) {
                  const cfg = (settingsMap as any)[exId]
                  if (!cfg) continue
                  const n = reps.length
                  const tSets = Number(cfg.target_sets) || 5
                  const tReps = Number(cfg.target_reps) || 5
                  const tMin  = Number(cfg.target_reps_min) || 8
                  const allTop   = reps.every(r => r >= tReps)
                  const allFloor = reps.every(r => r >= tMin)
                  let o: BaseOutcome
                  if (n >= tSets && allTop)                                    o = 'success'
                  else if (cfg.protocol === 'double' && n >= tSets && allFloor) o = 'maintenance'
                  else                                                           o = 'failure'
                  exOutcomes.set(exId, o)
                }
                baseOutcomeMap.set(w.id, exOutcomes)
              }

              // ── Pre-pass 2: consecutive streaks per (workout × exercise) ─────────
              // historyWorkouts is newest-first; older workouts have higher indices.
              // For each workout, count how many consecutive same-type outcomes end HERE,
              // walking backwards through older sessions (skipping days not logged).
              const failureStreakMap = new Map<string, Map<string, number>>()
              const successStreakMap = new Map<string, Map<string, number>>()
              for (let i = 0; i < historyWorkouts.length; i++) {
                const exMap = baseOutcomeMap.get(historyWorkouts[i].id) ?? new Map<string, BaseOutcome>()
                const fStreaks = new Map<string, number>()
                const sStreaks = new Map<string, number>()
                for (const [exId, outcome] of exMap) {
                  const target = outcome === 'failure' ? 'failure' : outcome === 'success' ? 'success' : null
                  if (!target) { fStreaks.set(exId, 0); sStreaks.set(exId, 0); continue }
                  let count = 1
                  for (let j = i + 1; j < historyWorkouts.length; j++) {
                    const o = baseOutcomeMap.get(historyWorkouts[j].id)?.get(exId)
                    if (o === target) count++
                    else if (o !== undefined) break   // different outcome ends the streak
                    // o === undefined → exercise not logged that day → skip
                  }
                  fStreaks.set(exId, outcome === 'failure' ? count : 0)
                  sStreaks.set(exId, outcome === 'success' ? count : 0)
                }
                failureStreakMap.set(historyWorkouts[i].id, fStreaks)
                successStreakMap.set(historyWorkouts[i].id, sStreaks)
              }

              return historyWorkouts.map((workout) => {
              const date = new Date(workout.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              const hasRunning = (workout.running_logs?.length ?? 0) > 0
              const hasStrength = (workout.strength_logs?.length ?? 0) > 0

              // Derive PR flag and exercise names from nested sets
              const allSets = (workout.strength_logs ?? []).flatMap((l: any) => l.strength_sets ?? [])
              const hasPR = allSets.some((s: any) => s.is_pr)

              // Group sets by exercise (preserving first-seen order)
              const exerciseOrder: string[] = []
              const setsByExercise = new Map<string, { name: string }>()
              for (const s of allSets as any[]) {
                const exId: string = s.exercise_id
                if (!exId) continue
                if (!setsByExercise.has(exId)) {
                  exerciseOrder.push(exId)
                  setsByExercise.set(exId, { name: s.exercises?.name ?? 'Unknown' })
                }
              }

              const exerciseNames = exerciseOrder.map(id => setsByExercise.get(id)!.name)

              // Map pre-computed base outcomes to final display outcomes
              type Outcome = 'success_increase' | 'success' | 'maintenance' | 'failure_deload' | 'failure'
              const outcomes: { name: string; outcome: Outcome }[] = []
              for (const exId of exerciseOrder) {
                const cfg = (settingsMap as any)[exId]
                if (!cfg) continue
                const base = baseOutcomeMap.get(workout.id)?.get(exId)
                if (!base) continue

                const minSuccesses  = Number(cfg.min_successes) || 1
                const maxFails     = Number(cfg.max_failures)  || 3
                const failStreak   = failureStreakMap.get(workout.id)?.get(exId) ?? 0
                const successStreak = successStreakMap.get(workout.id)?.get(exId) ?? 0

                let outcome: Outcome
                if (base === 'success') {
                  // Triangle when the success streak reaches the min_successes threshold
                  // (meaning weight goes up next session)
                  outcome = successStreak >= minSuccesses ? 'success_increase' : 'success'
                } else if (base === 'maintenance') {
                  outcome = 'maintenance'
                } else {
                  // Triangle when failure streak hits max_failures → deload fires next session
                  outcome = failStreak >= maxFails ? 'failure_deload' : 'failure'
                }
                outcomes.push({ name: setsByExercise.get(exId)!.name, outcome })
              }

              // Running summary
              const totalKm = (workout.running_logs ?? []).reduce((sum: number, l: any) => sum + (l.distance_km ?? 0), 0)

              return (
                <li key={workout.id}>
                  <Link href={`/workout/${workout.id}`} className="block bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-gray-300 transition-colors cursor-pointer">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <strong className="text-gray-900 font-bold leading-snug">{workout.title}</strong>
                      <span className="text-xs text-gray-400 shrink-0">{date}</span>
                    </div>

                    {/* Type tags + PR badge */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {hasRunning && (
                        <span className="text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-md">
                          🏃 {totalKm > 0 ? `${totalKm.toFixed(1)} km` : 'Cardio'}
                        </span>
                      )}
                      {hasStrength && (
                        <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                          🏋️ Strength
                        </span>
                      )}
                      {hasPR && (
                        <span className="text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-100 px-2 py-0.5 rounded-md">
                          🏆 PR
                        </span>
                      )}
                      {!hasRunning && !hasStrength && (
                        <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
                          📝 Empty
                        </span>
                      )}
                    </div>

                    {/* Exercise names + outcome dots */}
                    {exerciseNames.length > 0 && (
                      <div className="flex items-center gap-2 mb-1.5 min-w-0">
                        <p className="text-xs text-gray-400 truncate">
                          {exerciseNames.slice(0, 4).join(' · ')}
                          {exerciseNames.length > 4 && ` +${exerciseNames.length - 4}`}
                        </p>
                        {outcomes.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0">
                            {outcomes.map((o, i) => {
                              if (o.outcome === 'success_increase') return (
                                <span key={i} title={`${o.name}: success (weight ↑)`}
                                  className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-green-400" />
                              )
                              if (o.outcome === 'failure_deload') return (
                                <span key={i} title={`${o.name}: failure (deload)`}
                                  className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-t-[7px] border-l-transparent border-r-transparent border-t-red-400" />
                              )
                              if (o.outcome === 'maintenance') return (
                                <span key={i} title={`${o.name}: maintenance`}
                                  className="inline-block w-2 h-2 bg-blue-400" />
                              )
                              return (
                                <span key={i} title={`${o.name}: ${o.outcome}`}
                                  className={`inline-block w-2 h-2 rounded-full ${o.outcome === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Duration */}
                    <p className="text-xs text-gray-400 font-medium">{workout.total_duration_mins} mins</p>
                  </Link>
                </li>
              )
              })
            })()}
          </ul>
        )}
      </section>
    </>
  )
}