import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { startFocusWorkout } from '@/app/page-actions'

// ── types ─────────────────────────────────────────────────────────────────────
type SetRow = { actual_reps: number | null; actual_weight: number | null }

// ── helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1)  return 'just now'
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── main component ────────────────────────────────────────────────────────────
export default async function FocusDashboard({
  userId,
  exerciseId,
}: {
  userId: string
  exerciseId: string
}) {
  const supabase = await createClient()

  // Fetch exercise meta + current settings in parallel
  const [{ data: exercise }, { data: setting }, { data: recentSets }] = await Promise.all([
    supabase
      .from('exercises')
      .select('id, name, muscle_group')
      .eq('id', exerciseId)
      .maybeSingle(),

    supabase
      .from('user_exercise_settings')
      .select('target_reps, target_reps_min, current_weight, progression_rate, protocol, target_sets, min_successes, current_successes')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .eq('is_active', true)
      .maybeSingle(),

    // Last 5 workout sessions that included this exercise
    supabase
      .from('strength_sets')
      .select(`
        actual_reps, actual_weight,
        strength_logs!inner ( workout_id,
          workouts!inner ( id, created_at, total_duration_mins, user_id )
        )
      `)
      .eq('exercise_id', exerciseId)
      .not('strength_logs.workouts.total_duration_mins', 'is', null)
      .eq('strength_logs.workouts.user_id', userId)
      .order('created_at', { referencedTable: 'strength_logs.workouts', ascending: false })
      .limit(30),
  ])

  if (!exercise) return null

  // Check for active (in-progress) workout
  const { data: activeWorkout } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .is('total_duration_mins', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Group sets by workout session
  type Session = { workoutId: string; date: string; sets: SetRow[] }
  const sessionMap = new Map<string, Session>()
  for (const row of (recentSets ?? []) as any[]) {
    const log     = row.strength_logs
    const workout = log?.workouts
    if (!workout?.id) continue
    if (!sessionMap.has(workout.id)) {
      sessionMap.set(workout.id, { workoutId: workout.id, date: workout.created_at, sets: [] })
    }
    sessionMap.get(workout.id)!.sets.push({ actual_reps: row.actual_reps, actual_weight: row.actual_weight })
  }
  const sessions = [...sessionMap.values()]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const lastSession = sessions[0]
  const maxReps = lastSession
    ? Math.max(...lastSession.sets.map(s => Number(s.actual_reps) || 0))
    : null

  const protocol      = setting?.protocol ?? 'manual'
  const currentWeight = Number(setting?.current_weight) || 0
  const successes     = Number(setting?.current_successes) || 0
  const minSucc       = Number(setting?.min_successes) || 1
  const progRate      = Number(setting?.progression_rate) || 2.5
  const nextWeight    = currentWeight + progRate
  const targetSets    = Number(setting?.target_sets) || 3
  const targetReps    = Number(setting?.target_reps) || 5
  const targetRepsMin = Number(setting?.target_reps_min) || 8

  // Protocol drives the display, not current_weight
  // amrap = rep-goal mode (bodyweight, e.g. pullups toward 10)
  // linear / double / manual = weight-based mode
  const isRepGoal = protocol === 'amrap'

  // Rep label per protocol
  const repLabel = protocol === 'double'
    ? `${targetRepsMin}–${targetReps}`
    : protocol === 'amrap'
    ? `${targetRepsMin} + AMRAP`
    : `${targetReps}`

  // For rep-goal progress bar
  const goalReps    = targetReps
  const currentBest = maxReps ?? 0
  const pct         = isRepGoal ? Math.min(100, Math.round((currentBest / goalReps) * 100)) : 0

  // Focus workout action bound to this exercise
  const startAction = startFocusWorkout.bind(null, exerciseId)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white px-6 py-5 border-b border-gray-200 shadow-sm">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Training</p>
        <h1 className="text-2xl font-extrabold text-gray-900 mt-0.5">{exercise.name}</h1>
      </header>

      <div className="px-6 py-6 space-y-5">

        {/* Goal / current state — different for bodyweight vs weighted */}
        {isRepGoal ? (
          /* Bodyweight: show rep progress toward goal */
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Goal</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{goalReps} reps</p>
              </div>
              <p className="text-3xl font-extrabold text-blue-600">{pct}%</p>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {maxReps !== null && (
              <p className="text-xs text-gray-400 font-medium mt-2">Last session best: {maxReps} reps</p>
            )}
          </div>
        ) : (
          /* Weighted: show current weight + today's target */
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current weight</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-0.5">
                  {currentWeight}<span className="text-sm font-normal text-gray-400 ml-1">kg</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Next</p>
                <p className="text-2xl font-extrabold text-green-600 mt-0.5">
                  {nextWeight}<span className="text-sm font-normal text-gray-400 ml-1">kg</span>
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500">
                Today: {targetSets}×{repLabel} reps
                {protocol !== 'manual' && successes > 0 && (
                  <span className="ml-2 text-green-600">· {successes}/{minSucc} toward next weight</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Start / resume training */}
        {activeWorkout ? (
          <Link
            href={`/workout/${activeWorkout.id}?focus=${exerciseId}`}
            className="block w-full bg-red-500 hover:bg-red-600 text-white font-extrabold text-lg py-4 rounded-2xl text-center transition-colors shadow-sm"
          >
            🔴 Resume training
          </Link>
        ) : (
          <form action={startAction}>
            <button
              type="submit"
              className="w-full bg-black hover:bg-gray-800 text-white font-extrabold text-lg py-4 rounded-2xl transition-colors shadow-sm"
            >
              Start training session
            </button>
          </form>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-5 pt-4 pb-2">
              Recent sessions
            </p>
            {sessions.map((s, i) => {
              const best = Math.max(...s.sets.map(r => Number(r.actual_reps) || 0))
              const totalSets = s.sets.length
              return (
                <div
                  key={s.workoutId}
                  className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <span className="text-sm text-gray-500 font-medium">{timeAgo(s.date)}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {totalSets} sets · best {best} reps
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Link to full exercise page */}
        <Link
          href={`/exercises/${exerciseId}`}
          className="block text-center text-sm font-bold text-gray-400 hover:text-gray-700 transition-colors py-2"
        >
          View full stats →
        </Link>

      </div>
    </div>
  )
}
