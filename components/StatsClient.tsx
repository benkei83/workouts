'use client'

import { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { getBestSetMethod } from '@/lib/stats/compute'

type ExerciseStat = {
  id: string
  name: string
  pr: number
  totalVolume: number
  sessionCount: number
  trend: 'up' | 'flat' | 'down'
  history: { date: string; weight: number; volume: number }[]
  targetReps?: number | null
  best1rmSet?: { weight: number; reps: number; orm: number; date: string }
  bestVolumeSet?: { weight: number; reps: number; volume: number; date: string }
}

type Props = {
  totalWorkouts: number
  streak: number
  totalKgLifted: number
  totalKm: number
  weeklyBuckets: { label: string; count: number }[]
  exercises: ExerciseStat[]
  avgSpeed: number
  recentRuns: { date: string; km: number; speed: number; type: string }[]
  cardioSessionCount: number
}

// ── Shared tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-gray-500 text-[11px] font-medium mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-bold text-gray-900">
          {p.value}{unit ?? ''}
        </p>
      ))}
    </div>
  )
}

// ── Per-exercise weight chart ─────────────────────────────────────────────────

function WeightChart({ history }: { history: { date: string; weight: number }[] }) {
  if (history.length < 2) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">Not enough sessions to chart yet.</p>
    )
  }

  const data = history.map(h => ({
    date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: h.weight,
  }))

  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 8, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip unit="kg" />} />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#111827"
            strokeWidth={2}
            dot={{ r: 2.5, fill: '#111827', strokeWidth: 0 }}
            activeDot={{ r: 4, fill: '#111827' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Consistency bar chart ─────────────────────────────────────────────────────

function ConsistencyChart({ buckets }: { buckets: { label: string; count: number }[] }) {
  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barSize={14}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 8, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide allowDecimals={false} />
          <Tooltip content={<CustomTooltip unit=" workouts" />} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell
                key={i}
                fill={i === buckets.length - 1 ? '#111827' : b.count > 0 ? '#d1d5db' : '#f3f4f6'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Exercise drill-down modal ─────────────────────────────────────────────────

function ExerciseModal({ ex, onClose }: { ex: ExerciseStat; onClose: () => void }) {
  const { method, hasNoSettings } = getBestSetMethod(ex.targetReps)
  const primaryBestSet = method === '1rm'
    ? ex.best1rmSet
    : (ex.bestVolumeSet ? { weight: ex.bestVolumeSet.weight, reps: ex.bestVolumeSet.reps, orm: ex.bestVolumeSet.volume, date: ex.bestVolumeSet.date } : ex.best1rmSet)
  const effectiveMethod = (method === 'volume' && !ex.bestVolumeSet && ex.best1rmSet) ? '1rm' : method
  const isActual1rm = effectiveMethod === '1rm' && (ex.best1rmSet?.reps === 1)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start p-6 pb-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">{ex.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{ex.sessionCount} sessions logged</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 font-bold p-1">✕</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Best Set card */}
          {primaryBestSet ? (
            <div className="mx-6 mb-4 bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Best Set</p>
                  <p className="text-2xl font-extrabold text-gray-900 leading-tight mt-0.5">
                    {primaryBestSet.weight}
                    <span className="text-sm font-normal text-gray-400 ml-0.5">kg</span>
                    <span className="text-gray-400 mx-2 font-normal text-xl">×</span>
                    {primaryBestSet.reps}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {effectiveMethod === '1rm'
                      ? isActual1rm
                        ? `1RM: ${ex.best1rmSet?.orm ?? 0}kg`
                        : `Est. 1RM: ${ex.best1rmSet?.orm ?? 0}kg`
                      : `${ex.bestVolumeSet?.volume ?? 0}kg vol`
                    }
                    {' · '}
                    {new Date(primaryBestSet.date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  {hasNoSettings && (
                    <p className="text-[10px] text-amber-500 mt-1">⚠ No target reps set — using 1RM method</p>
                  )}
                </div>
                <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0 mt-0.5 ${
                  isActual1rm ? 'text-amber-600 bg-amber-50' : 'text-gray-400 bg-gray-200'
                }`}>
                  {effectiveMethod === '1rm' ? (isActual1rm ? '1RM' : 'EST') : 'VOL'}
                </span>
              </div>
            </div>
          ) : null}

          {/* Stat chips */}
          <div className="grid grid-cols-2 gap-2 px-6 pb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-extrabold text-gray-900">
                {ex.pr}<span className="text-xs font-normal text-gray-400 ml-0.5">kg</span>
              </p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">PR</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-extrabold text-gray-900">
                {ex.totalVolume >= 1000 ? `${Math.round(ex.totalVolume / 1000)}k` : Math.round(ex.totalVolume)}
                <span className="text-xs font-normal text-gray-400 ml-0.5">kg</span>
              </p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Volume</p>
            </div>
          </div>

          {/* Chart */}
          <div className="px-6 pb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Weight over time
            </p>
            <WeightChart history={ex.history} />
          </div>

          {/* Recent sessions */}
          <div className="px-6 pb-6 mt-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Recent sessions
            </p>
            <div className="space-y-1">
              {[...ex.history].reverse().slice(0, 10).map((s, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">
                    {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex gap-4">
                    <span className="text-xs font-bold text-gray-900">{s.weight} kg</span>
                    <span className="text-xs text-gray-400">
                      {s.volume >= 1000 ? `${Math.round(s.volume / 1000)}k` : Math.round(s.volume)} vol
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Trend badge ───────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  if (trend === 'up')   return <span className="text-green-600 font-bold text-sm">↑</span>
  if (trend === 'down') return <span className="text-red-400 font-bold text-sm">↓</span>
  return <span className="text-gray-400 font-bold text-sm">→</span>
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function StatsClient({
  totalWorkouts,
  streak,
  totalKgLifted,
  totalKm,
  weeklyBuckets,
  exercises,
  avgSpeed,
  recentRuns,
  cardioSessionCount,
}: Props) {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseStat | null>(null)

  if (totalWorkouts === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-4">📊</p>
        <p className="font-bold text-gray-600">No data yet</p>
        <p className="text-sm mt-1">Complete your first workout to see stats here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Summary chips ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Workouts', value: totalWorkouts, unit: '' },
          { label: 'Streak', value: streak, unit: streak === 1 ? 'day' : 'days' },
          {
            label: 'Kg lifted',
            value: totalKgLifted >= 1000 ? `${(totalKgLifted / 1000).toFixed(1)}k` : totalKgLifted,
            unit: 'kg total',
          },
          { label: 'Km run', value: totalKm, unit: 'km total' },
        ].map(chip => (
          <div key={chip.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-2xl font-extrabold text-gray-900">
              {chip.value}
              <span className="text-sm font-normal text-gray-400 ml-1">{chip.unit}</span>
            </p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{chip.label}</p>
          </div>
        ))}
      </div>

      {/* ── Consistency ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
          Consistency — last 12 weeks
        </h2>
        <ConsistencyChart buckets={weeklyBuckets} />
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-gray-400">{weeklyBuckets[0]?.label}</span>
          <span className="text-[9px] text-black font-bold">This week</span>
        </div>
      </div>

      {/* ── Strength ── */}
      {exercises.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Strength</h2>
          <div className="space-y-2">
            {exercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => setSelectedExercise(ex)}
                className="w-full bg-white rounded-xl px-4 py-3.5 shadow-sm border border-gray-100 flex justify-between items-center hover:border-gray-300 transition-colors group text-left"
              >
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{ex.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ex.sessionCount} sessions · {ex.pr}kg PR
                    {(() => {
                      const { method: m } = getBestSetMethod(ex.targetReps)
                      const bs = m === '1rm' ? ex.best1rmSet : (ex.bestVolumeSet ?? ex.best1rmSet)
                      if (!bs) return null
                      const isActual = m === '1rm' && bs.reps === 1
                      const label = m === 'volume' && ex.bestVolumeSet ? 'vol' : isActual ? '1RM' : 'est'
                      return (
                        <span className={`ml-1.5 ${isActual ? 'text-amber-500' : 'text-gray-500'}`}>
                          · {bs.weight}kg×{bs.reps}
                          <span className="text-gray-400 ml-0.5">({label})</span>
                        </span>
                      )
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <TrendBadge trend={ex.trend} />
                  <span className="text-gray-300 group-hover:text-gray-700 font-bold text-sm transition-colors">›</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Cardio ── */}
      {cardioSessionCount > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Cardio</h2>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Sessions', value: cardioSessionCount },
              { label: 'Total km', value: totalKm },
              { label: 'Avg km/h', value: avgSpeed },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-xl font-extrabold text-gray-900">{c.value}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {recentRuns.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-2">
                Recent runs
              </p>
              {recentRuns.map((run, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center px-4 py-3 border-t border-gray-50 first:border-0"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900 capitalize">{run.type || 'Run'}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(run.date).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {run.km} <span className="font-normal text-gray-400 text-xs">km</span>
                    </p>
                    <p className="text-xs text-gray-400">{run.speed} km/h</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Drill-down modal ── */}
      {selectedExercise && (
        <ExerciseModal ex={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}
    </div>
  )
}
