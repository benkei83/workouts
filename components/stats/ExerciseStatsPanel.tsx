'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { computeExerciseStats, getBestSetMethod } from '@/lib/stats/compute'
import type { ExerciseHistorySession } from '@/lib/stats/compute'

function fmt(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function TrendIcon({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  if (trend === 'up')   return <span className="text-green-500 font-bold">↑</span>
  if (trend === 'down') return <span className="text-red-400 font-bold">↓</span>
  return <span className="text-gray-400 font-bold">→</span>
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-extrabold text-gray-900 leading-tight mt-0.5">{value}</p>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-gray-500 text-[11px] font-medium mb-0.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-bold text-gray-900">
          {p.name}: {p.value}kg
        </p>
      ))}
    </div>
  )
}

export default function ExerciseStatsPanel({
  history,
  targetReps,
}: {
  history: ExerciseHistorySession[]
  targetReps?: number | null
}) {
  const stats = computeExerciseStats(history)
  const { method, hasNoSettings } = getBestSetMethod(targetReps)

  if (stats.totalSessions === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No completed sessions yet.
      </p>
    )
  }

  // Determine which best-set to display based on the configured method
  const primaryBestSet = method === '1rm'
    ? stats.best1rmSet
    : (stats.bestVolumeSet ?? stats.best1rmSet)

  // Effective method handles the fallback when volume method has no volume data yet
  const effectiveMethod = (method === 'volume' && !stats.bestVolumeSet && stats.best1rmSet)
    ? '1rm'
    : method

  // Chart data — use last 20 sessions
  const chartData = stats.recentHistory.slice(-20).map(h => ({
    date: new Date(h.workoutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: h.maxWeight,
    // Estimated 1RM line: shown for sessions where the best came from a multi-rep set
    oneRM: (h.best1rmSet && h.best1rmSet.reps > 1) ? h.estimatedOneRM
           : (!h.best1rmSet && h.estimatedOneRM > h.maxWeight) ? h.estimatedOneRM
           : undefined,
    // Actual 1RM dots: only when the session's best was a genuine single
    actual1rm: (h.best1rmSet?.reps === 1) ? h.estimatedOneRM : undefined,
  }))

  const hasEstimatedSessions = chartData.some(d => d.oneRM !== undefined)
  const hasActual1rmSessions = chartData.some(d => d.actual1rm !== undefined)

  // Last 5 sessions for the table (newest first)
  const recent5 = [...stats.recentHistory].reverse().slice(0, 5)

  return (
    <div className="space-y-5">

      {/* ── Best Set ── */}
      {primaryBestSet ? (
        <div className="bg-gray-50 rounded-xl px-4 py-3">
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
                  ? primaryBestSet.isActual1rm
                    ? `1RM: ${primaryBestSet.estimatedOneRM}kg`
                    : `Est. 1RM: ${primaryBestSet.estimatedOneRM}kg`
                  : `${primaryBestSet.singleSetVolume}kg vol`
                }
                {' · '}
                {fmtDate(primaryBestSet.date)}
              </p>
              {hasNoSettings && (
                <p className="text-[10px] text-amber-500 mt-1.5">
                  ⚠ No target reps set — using 1RM method
                </p>
              )}
            </div>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-200 rounded-md px-1.5 py-0.5 flex-shrink-0 mt-0.5">
              {primaryBestSet.isActual1rm && effectiveMethod === '1rm'
                ? '1RM'
                : effectiveMethod === '1rm' ? 'EST' : 'VOL'
              }
            </span>
          </div>
        </div>
      ) : (
        /* Fallback for old data without best-set tracking */
        <div className="grid grid-cols-2 gap-2">
          <StatPill label="All-time PR" value={`${stats.allTimePR}kg`} />
          <StatPill label="Sessions" value={String(stats.totalSessions)} />
        </div>
      )}

      {/* ── Secondary stats ── */}
      <div className="grid grid-cols-2 gap-2">
        <StatPill label="Sessions" value={String(stats.totalSessions)} />
        <StatPill label="Total Volume" value={fmt(stats.totalVolume)} />
      </div>

      {/* ── Trend ── */}
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-gray-500">Weight trend:</p>
        <TrendIcon trend={stats.weightTrend} />
        <p className="text-xs font-semibold text-gray-700 capitalize">{stats.weightTrend}</p>
      </div>

      {/* ── Weight-over-time chart ── */}
      {chartData.length >= 2 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Weight History
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tickFormatter={v => `${v}`}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Max weight per session */}
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Weight"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#111827' }}
                />

                {/* Estimated 1RM — dashed purple, only for multi-rep sessions */}
                {hasEstimatedSessions && (
                  <Line
                    type="monotone"
                    dataKey="oneRM"
                    name="Est. 1RM"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    connectNulls={false}
                    activeDot={{ r: 3, fill: '#6366f1' }}
                  />
                )}

                {/* Actual 1RM — amber dots, no connecting line */}
                {hasActual1rmSessions && (
                  <Line
                    type="monotone"
                    dataKey="actual1rm"
                    name="1RM"
                    stroke="#f59e0b"
                    strokeWidth={0}
                    dot={{ r: 5, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#f59e0b' }}
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-1 justify-end">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-gray-900" />
              <span className="text-[10px] text-gray-400">Weight</span>
            </div>
            {hasEstimatedSessions && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-indigo-500 opacity-70" style={{ borderTop: '2px dashed' }} />
                <span className="text-[10px] text-gray-400">Est. 1RM</span>
              </div>
            )}
            {hasActual1rmSessions && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow-sm" />
                <span className="text-[10px] text-gray-400">1RM</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Recent sessions ── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Recent Sessions
        </p>
        <div className="space-y-1">
          {recent5.map((s, i) => {
            const isActual = s.best1rmSet?.reps === 1
            return (
              <div
                key={i}
                className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
              >
                <span className="text-gray-500 text-[11px] font-medium w-16 flex-shrink-0">
                  {new Date(s.workoutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="font-bold text-gray-900">{s.maxWeight}kg</span>
                <span className="text-gray-400 text-xs">{s.sets}×{s.avgReps} reps</span>
                <span className="text-xs font-medium">
                  {isActual
                    ? <span className="text-amber-500">1RM</span>
                    : <span className="text-gray-500">{fmt(s.totalVolume)}</span>
                  }
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
