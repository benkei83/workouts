import { Suspense } from 'react'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ExerciseStatsPanel from '@/components/stats/ExerciseStatsPanel'
import { fetchExercisePageData } from '@/app/exercises/actions'
import { computeRepMaxes, computeExerciseFrequency } from '@/lib/stats/compute'
import { MUSCLE_GROUPS, EQUIPMENT_LABELS } from '@/lib/muscleGroups'

const MG_LABELS: Record<string, string> = Object.fromEntries(MUSCLE_GROUPS.map(g => [g.id, g.label]))

export default function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      <Suspense fallback={
        <>
          <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
            <Link href="/exercises" className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full font-bold text-gray-500">←</Link>
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          </header>
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-24 bg-gray-200 rounded-2xl" />
            <div className="h-44 bg-gray-200 rounded-2xl" />
          </div>
        </>
      }>
        <ExerciseDetailLoader params={params} />
      </Suspense>
    </main>
  )
}

function fmt(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function ExerciseDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  noStore()
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: exercise } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, equipment')
    .eq('id', id)
    .maybeSingle()

  if (!exercise) notFound()

  const { data: setting } = await supabase
    .from('user_exercise_settings')
    .select('target_reps')
    .eq('user_id', user.id)
    .eq('exercise_id', id)
    .eq('is_active', true)
    .maybeSingle()

  const { history, cleanSets } = await fetchExercisePageData(id)
  const repMaxes = computeRepMaxes(cleanSets)
  const frequency = computeExerciseFrequency(history)

  return (
    <>
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link href="/exercises" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500">←</Link>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight truncate">{exercise.name}</h1>
          {(exercise.muscle_group || exercise.equipment) && (
            <p className="text-xs text-gray-400 font-medium">
              {[MG_LABELS[exercise.muscle_group] ?? exercise.muscle_group, EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment]
                .filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </header>

      <div className="p-6 space-y-6">
        {history.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm font-semibold">No completed sessions yet</p>
            <p className="text-xs mt-1">Log this exercise in a workout to see stats here.</p>
          </div>
        ) : (
          <>
            {/* ── Frequency ── */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-xl font-extrabold text-gray-900">{frequency.totalSessions}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Sessions</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-xl font-extrabold text-gray-900">{frequency.sessionsLast30}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Last 30d</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-xl font-extrabold text-gray-900">
                  {frequency.daysSinceLast === 0 ? 'Today' : frequency.daysSinceLast != null ? `${frequency.daysSinceLast}d` : '—'}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Since last</p>
              </div>
            </div>

            {/* ── Rep-max ladder ── */}
            {repMaxes.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Rep maxes</h2>
                <div className="space-y-1">
                  {repMaxes.map(rm => (
                    <div key={rm.reps} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-bold text-gray-500 w-14 flex-shrink-0">{rm.reps}+ reps</span>
                      <span className="text-sm font-extrabold text-gray-900">{rm.weight}kg</span>
                      <span className="text-[11px] text-gray-400 tabular-nums">
                        {rm.weight}kg×{rm.actualReps} · ~{rm.estimatedOneRM}kg 1RM
                      </span>
                      <span className="text-[10px] text-gray-300 w-16 text-right flex-shrink-0">{fmtDate(rm.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Stats + chart + recent (reused from modal) ── */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <ExerciseStatsPanel history={history} targetReps={setting?.target_reps ?? null} />
            </div>

            {/* ── Total volume footnote ── */}
            <p className="text-center text-[11px] text-gray-400">
              {frequency.avgDaysBetween != null && `Trained on average every ${frequency.avgDaysBetween} days · `}
              Last performed {frequency.lastPerformed ? fmtDate(frequency.lastPerformed) : '—'}
            </p>
          </>
        )}
      </div>
    </>
  )
}
