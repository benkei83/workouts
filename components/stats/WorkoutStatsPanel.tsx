'use client'

import { useMemo } from 'react'
import {
  computeWorkoutStats,
  computeSessionBestSets,
  getBestSetMethod,
} from '@/lib/stats/compute'
import type {
  ExerciseMeta,
  RawStrengthSet,
  RawRunningLog,
  SessionBestSet,
  HistoricalBest,
} from '@/lib/stats/compute'

const MG_LABELS: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  arms: 'Arms', legs: 'Legs', core: 'Core', calves: 'Calves',
}

const MG_COLORS: Record<string, string> = {
  chest: 'bg-red-400', back: 'bg-blue-400', shoulders: 'bg-purple-400',
  arms: 'bg-orange-400', legs: 'bg-green-400', core: 'bg-yellow-400', calves: 'bg-teal-400',
}

function fmt(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`
}

function StatCard({
  label, value, sub,
}: {
  label: string; value: string; sub?: string
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

export default function WorkoutStatsPanel({
  strengthLogs,
  runningLogs,
  exercises,
  durationMins,
  exerciseSettingsMap = {},
  historicalBests = {},
}: {
  strengthLogs: { strength_sets: RawStrengthSet[] }[]
  runningLogs: RawRunningLog[]
  exercises: ExerciseMeta[]
  durationMins: number
  exerciseSettingsMap?: Record<string, { target_reps?: number | null } | null>
  historicalBests?: Record<string, HistoricalBest>
}) {
  const stats = useMemo(
    () => computeWorkoutStats({ strengthLogs, runningLogs, durationMins, exercises }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strengthLogs.length, runningLogs.length, durationMins]
  )

  // Session best sets (one per exercise, by configured method)
  const sessionBestSets: SessionBestSet[] = useMemo(
    () => computeSessionBestSets(strengthLogs, exercises, exerciseSettingsMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strengthLogs.length, exercises.length]
  )

  // New records: exercises where this session's best beats all-time history
  const newRecords: SessionBestSet[] = useMemo(() => {
    return sessionBestSets.filter(bs => {
      const hist = historicalBests[bs.exerciseId]
      if (!hist) return false // no history at all → not a "new" record relative to past
      if (bs.method === '1rm') return bs.estimatedOneRM > hist.best1rm
      return bs.singleSetVolume > hist.bestVolume
    })
  }, [sessionBestSets, historicalBests])

  const hasStrength = stats.totalSets > 0
  const hasMuscle   = Object.keys(stats.muscleGroupVolume).length > 0
  const maxMgVol    = Math.max(1, ...Object.values(stats.muscleGroupVolume))

  if (!hasStrength && stats.totalKmRun === 0) return null

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Session Stats</h3>

      {/* ── Section B: New Records ── */}
      {newRecords.length > 0 && (
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-3">
            🏆 New Records
          </p>
          <div className="space-y-2.5">
            {newRecords.map(bs => {
              const hist = historicalBests[bs.exerciseId]
              const label1rm = bs.isActual1rm ? '1RM' : 'Est. 1RM'
              const prevBest = bs.method === '1rm'
                ? hist ? `prev. ${hist.best1rm}kg ${label1rm}` : null
                : hist ? `prev. ${hist.bestVolume}kg vol` : null
              return (
                <div key={bs.exerciseId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate">{bs.name}</p>
                    {prevBest && (
                      <p className="text-[10px] text-amber-600">{prevBest}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold text-amber-700">
                      {bs.weight}kg × {bs.reps}
                    </p>
                    <p className="text-[10px] text-amber-600">
                      {bs.method === '1rm'
                        ? `${bs.estimatedOneRM}kg ${label1rm}`
                        : `${bs.singleSetVolume}kg vol`
                      }
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Top numbers ── */}
      <div className="grid grid-cols-2 gap-3">
        {hasStrength && (
          <>
            <StatCard
              label="Total Volume"
              value={fmt(stats.totalVolume)}
              sub="weight × reps"
            />
            <StatCard
              label="Sets Logged"
              value={String(stats.totalSets)}
              sub={`avg ${stats.avgWeightPerSet}kg / set`}
            />
          </>
        )}
        {stats.durationMins > 0 && (
          <StatCard
            label="Time in Gym"
            value={`${stats.durationMins}m`}
            sub={hasStrength && stats.setsPerHour > 0 ? `${stats.setsPerHour} sets/hr` : undefined}
          />
        )}
        {stats.totalKmRun > 0 && (
          <StatCard
            label="Distance Run"
            value={`${stats.totalKmRun}km`}
          />
        )}
      </div>

      {/* ── Muscle group breakdown ── */}
      {hasMuscle && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Volume by Muscle
          </p>
          <div className="space-y-2.5">
            {Object.entries(stats.muscleGroupVolume)
              .sort(([, a], [, b]) => b - a)
              .map(([mg, vol]) => (
                <div key={mg}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-600">
                      {MG_LABELS[mg] ?? mg}
                    </span>
                    <span className="text-xs font-bold text-gray-800">{fmt(Math.round(vol))}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${MG_COLORS[mg] ?? 'bg-gray-400'}`}
                      style={{ width: `${Math.round((vol / maxMgVol) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Section A: Best Set per Exercise ── */}
      {sessionBestSets.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Best Sets This Session
          </p>
          <div className="space-y-3">
            {sessionBestSets.map(bs => (
              <div key={bs.exerciseId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <p className="text-sm font-bold text-gray-900 truncate pr-2">{bs.name}</p>
                    <p className="text-sm font-extrabold text-gray-800 flex-shrink-0">
                      {bs.weight}kg × {bs.reps}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold rounded px-1 py-0.5 ${
                      bs.isActual1rm
                        ? 'text-amber-600 bg-amber-50'
                        : 'text-gray-400 bg-gray-100'
                    }`}>
                      {bs.method === '1rm' ? (bs.isActual1rm ? '1RM' : 'EST') : 'VOL'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {bs.method === '1rm'
                        ? bs.isActual1rm
                          ? `1RM: ${bs.estimatedOneRM}kg`
                          : `Est. 1RM: ${bs.estimatedOneRM}kg`
                        : `${bs.singleSetVolume}kg vol`
                      }
                    </span>
                    {bs.hasNoSettings && (
                      <span className="text-[10px] text-amber-400" title="No target reps set — defaulting to 1RM">⚠</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Exercise volume breakdown ── */}
      {stats.topExercises.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Volume by Exercise
          </p>
          <div className="space-y-3">
            {stats.topExercises.map(ex => (
              <div key={ex.exerciseId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className="text-sm font-bold text-gray-900 truncate pr-2">{ex.name}</p>
                    <p className="text-xs font-bold text-gray-600 flex-shrink-0">{fmt(ex.volume)}</p>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {ex.sets} sets · {ex.maxWeight}kg max · {ex.avgReps} avg reps
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
