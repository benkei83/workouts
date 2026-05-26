'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { computeExerciseStats } from '@/lib/stats/compute'
import type { ExerciseHistorySession } from '@/lib/stats/compute'

function fmt(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`
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
}: {
  history: ExerciseHistorySession[]
}) {
  const stats = computeExerciseStats(history)

  if (stats.totalSessions === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No completed sessions yet.
      </p>
    )
  }

  // Chart data — use last 20 sessions
  const chartData = stats.recentHistory.slice(-20).map(h => ({
    date: new Date(h.workoutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: h.maxWeight,
    oneRM: h.estimatedOneRM,
  }))

  const showOneRM = stats.recentHistory.some(h => h.avgReps > 1)

  // Last 5 sessions for the table (newest first)
  const recent5 = [...stats.recentHistory].reverse().slice(0, 5)

  return (
    <div className="space-y-5">

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-2">
        <StatPill label="All-time PR" value={`${stats.allTimePR}kg`} />
        {showOneRM && (
          <StatPill label="Est. 1RM" value={`${stats.bestEstimatedOneRM}kg`} />
        )}
        <StatPill label="Sessions" value={String(stats.totalSessions)} />
        <StatPill label="Total Volume" value={fmt(stats.totalVolume)} />
      </div>

      {/* Trend label */}
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-gray-500">Weight trend:</p>
        <TrendIcon trend={stats.weightTrend} />
        <p className="text-xs font-semibold text-gray-700 capitalize">{stats.weightTrend}</p>
      </div>

      {/* Weight-over-time chart */}
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
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Weight"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#111827' }}
                />
                {showOneRM && (
                  <Line
                    type="monotone"
                    dataKey="oneRM"
                    name="Est. 1RM"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={{ r: 3, fill: '#6366f1' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {showOneRM && (
            <div className="flex items-center gap-4 mt-1 justify-end">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-gray-900" />
                <span className="text-[10px] text-gray-400">Weight</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-indigo-500 opacity-70" style={{ borderTop: '2px dashed' }} />
                <span className="text-[10px] text-gray-400">Est. 1RM</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent sessions */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Recent Sessions
        </p>
        <div className="space-y-1">
          {recent5.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
            >
              <span className="text-gray-500 text-[11px] font-medium w-16 flex-shrink-0">
                {new Date(s.workoutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="font-bold text-gray-900">{s.maxWeight}kg</span>
              <span className="text-gray-400 text-xs">{s.sets}×{s.avgReps} reps</span>
              <span className="text-gray-500 text-xs font-medium">{fmt(s.totalVolume)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
