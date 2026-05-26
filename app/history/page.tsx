import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { computeWorkoutOutcomes } from '@/lib/workoutOutcomes'

export default function HistoryPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-7 z-10 shadow-sm flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500"
        >
          ←
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Workout History</h1>
      </header>

      <div className="px-6 mt-6">
        <Suspense fallback={
          <div className="space-y-3 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
        }>
          <HistoryLoader />
        </Suspense>
      </div>
    </main>
  )
}

async function HistoryLoader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const [{ data: workouts }, { data: exerciseSettings }] = await Promise.all([
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
      .eq('user_id', user.id)
      .not('total_duration_mins', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_exercise_settings')
      .select('exercise_id, protocol, target_sets, target_reps, target_reps_min, min_successes, max_failures')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  const historyWorkouts = workouts || []

  const settingsMap = Object.fromEntries(
    (exerciseSettings || [])
      .filter(s => s.protocol && s.protocol !== 'manual')
      .map(s => [s.exercise_id, s])
  )

  const outcomesByWorkout = computeWorkoutOutcomes(historyWorkouts, settingsMap)

  if (historyWorkouts.length === 0) {
    return (
      <p className="text-gray-500 text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
        No completed workouts yet. Time to break a sweat!
      </p>
    )
  }

  // Group by month for cleaner navigation
  type MonthGroup = { label: string; workouts: (typeof historyWorkouts) }
  const monthGroups: MonthGroup[] = []
  let currentLabel = ''

  for (const w of historyWorkouts) {
    const label = new Date(w.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (label !== currentLabel) {
      currentLabel = label
      monthGroups.push({ label, workouts: [] })
    }
    monthGroups[monthGroups.length - 1].workouts.push(w)
  }

  return (
    <div className="space-y-8 pb-4">
      <p className="text-sm text-gray-400 font-medium">{historyWorkouts.length} workouts total</p>

      {monthGroups.map(group => (
        <div key={group.label}>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{group.label}</h2>
          <ul className="space-y-3">
            {group.workouts.map(workout => {
              const date = new Date(workout.created_at).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })
              const hasRunning  = (workout.running_logs?.length ?? 0) > 0
              const hasStrength = (workout.strength_logs?.length ?? 0) > 0
              const allSets     = (workout.strength_logs ?? []).flatMap((l: any) => l.strength_sets ?? [])
              const hasPR       = allSets.some((s: any) => s.is_pr)
              const totalKmW    = (workout.running_logs ?? []).reduce(
                (sum: number, l: any) => sum + (l.distance_km ?? 0), 0
              )

              const exerciseOrder: string[] = []
              const exNames = new Map<string, string>()
              for (const s of allSets as any[]) {
                if (!s.exercise_id || exNames.has(s.exercise_id)) continue
                exerciseOrder.push(s.exercise_id)
                exNames.set(s.exercise_id, (s.exercises as any)?.name ?? 'Unknown')
              }
              const exerciseNames = exerciseOrder.map(id => exNames.get(id)!)
              const outcomes = outcomesByWorkout.get(workout.id) ?? []

              return (
                <li key={workout.id}>
                  <Link
                    href={`/workout/${workout.id}`}
                    className="block bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-gray-300 transition-colors"
                  >
                    {/* Title + date */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <strong className="text-gray-900 font-bold leading-snug">{workout.title}</strong>
                      <span className="text-xs text-gray-400 shrink-0">{date}</span>
                    </div>

                    {/* Type tags */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {hasRunning && (
                        <span className="text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-md">
                          🏃 {totalKmW > 0 ? `${totalKmW.toFixed(1)} km` : 'Cardio'}
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
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
