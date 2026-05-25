'use client'

import { useState } from 'react'

type ExerciseStat = {
  id: string
  name: string
  pr: number
  totalVolume: number
  sessionCount: number
  trend: 'up' | 'flat' | 'down'
  history: { date: string; weight: number; volume: number }[]
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

function TrendBadge({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  if (trend === 'up') return <span className="text-green-600 font-bold text-sm">↑</span>
  if (trend === 'down') return <span className="text-red-400 font-bold text-sm">↓</span>
  return <span className="text-gray-400 font-bold text-sm">→</span>
}

function WeightChart({ history }: { history: { date: string; weight: number }[] }) {
  if (history.length < 2) return (
    <p className="text-xs text-gray-400 text-center py-4">Not enough sessions to chart yet.</p>
  )

  const W = 320, H = 100, PAD = { top: 8, bottom: 24, left: 36, right: 8 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const weights = history.map(h => h.weight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 1

  const px = (i: number) => PAD.left + (i / (history.length - 1)) * innerW
  const py = (w: number) => PAD.top + innerH - ((w - minW) / range) * innerH

  const points = history.map((h, i) => `${px(i)},${py(h.weight)}`).join(' ')

  // Y grid lines at min/mid/max
  const mid = (minW + maxW) / 2
  const gridVals = [minW, mid, maxW]

  // X axis: show a few dates
  const xLabels = history.length <= 6
    ? history.map((h, i) => ({ i, label: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))
    : [0, Math.floor(history.length / 2), history.length - 1].map(i => ({
        i,
        label: new Date(history[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      {/* Grid lines */}
      {gridVals.map((v, gi) => (
        <g key={gi}>
          <line
            x1={PAD.left} y1={py(v)} x2={W - PAD.right} y2={py(v)}
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3"
          />
          <text x={PAD.left - 4} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
            {v % 1 === 0 ? v : v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${px(0)},${py(minW)} ${points} ${px(history.length - 1)},${py(minW)}`}
        fill="url(#chartGrad)"
      />

      {/* Line */}
      <polyline points={points} fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {history.map((h, i) => (
        <circle key={i} cx={px(i)} cy={py(h.weight)} r="2.5" fill="#000" />
      ))}

      {/* X labels */}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">{label}</text>
      ))}
    </svg>
  )
}

function ExerciseModal({ ex, onClose }: { ex: ExerciseStat; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
        <div className="flex justify-between items-start p-6 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">{ex.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{ex.sessionCount} sessions logged</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 font-bold p-1">✕</button>
        </div>

        {/* Stat chips */}
        <div className="grid grid-cols-3 gap-3 px-6 pb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-lg font-extrabold text-gray-900">{ex.pr}<span className="text-xs font-normal text-gray-400 ml-0.5">kg</span></p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">PR</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-lg font-extrabold text-gray-900">
              {ex.totalVolume >= 1000 ? `${Math.round(ex.totalVolume / 1000)}k` : Math.round(ex.totalVolume)}
              <span className="text-xs font-normal text-gray-400 ml-0.5">kg</span>
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Volume</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-lg font-extrabold text-gray-900 flex items-center justify-center gap-1">
              {ex.history.length > 0 ? ex.history[ex.history.length - 1].weight : '—'}
              <span className="text-xs font-normal text-gray-400">kg</span>
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Last</p>
          </div>
        </div>

        {/* Chart */}
        <div className="px-6 pb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Weight over time</p>
          <WeightChart history={ex.history} />
        </div>

        {/* Recent sessions */}
        <div className="px-6 pb-6 mt-2 max-h-48 overflow-y-auto">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Recent sessions</p>
          <div className="space-y-1.5">
            {[...ex.history].reverse().slice(0, 10).map((s, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">
                  {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="flex gap-3">
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
  )
}

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

  const maxWeekCount = Math.max(...weeklyBuckets.map(b => b.count), 1)

  const isEmpty = totalWorkouts === 0

  if (isEmpty) {
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
          { label: 'Kg lifted', value: totalKgLifted >= 1000 ? `${(totalKgLifted / 1000).toFixed(1)}k` : totalKgLifted, unit: 'kg total' },
          { label: 'Km run', value: totalKm, unit: 'km total' },
        ].map(chip => (
          <div key={chip.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-2xl font-extrabold text-gray-900">{chip.value}<span className="text-sm font-normal text-gray-400 ml-1">{chip.unit}</span></p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{chip.label}</p>
          </div>
        ))}
      </div>

      {/* ── Consistency ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Consistency — last 12 weeks</h2>
        <div className="flex items-end gap-1 h-20">
          {weeklyBuckets.map((b, i) => {
            const isThisWeek = i === weeklyBuckets.length - 1
            const heightPct = (b.count / maxWeekCount) * 100
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${b.label}: ${b.count} workout${b.count !== 1 ? 's' : ''}`}>
                <div
                  className={`w-full rounded-t-md transition-all ${isThisWeek ? 'bg-black' : b.count > 0 ? 'bg-gray-300' : 'bg-gray-100'}`}
                  style={{ height: b.count > 0 ? `${Math.max(heightPct, 15)}%` : '8%' }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2">
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
                  <p className="text-xs text-gray-400 mt-0.5">{ex.sessionCount} sessions • {ex.pr} kg PR</p>
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
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-2">Recent runs</p>
              {recentRuns.map((run, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-3 border-t border-gray-50 first:border-0">
                  <div>
                    <p className="text-sm font-bold text-gray-900 capitalize">{run.type || 'Run'}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(run.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{run.km} <span className="font-normal text-gray-400 text-xs">km</span></p>
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
