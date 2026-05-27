'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { logBodyWeight, deleteBodyWeightLog } from '@/app/weight/actions'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WeightLog {
  id: string
  logged_at: string  // YYYY-MM-DD
  weight_kg: number
  note: string | null
}

export interface TopLift {
  name: string
  orm: number  // estimated 1RM in kg
}

interface Props {
  weightLogs: WeightLog[]
  topLifts: TopLift[]
  heightCm: number | null
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toLocaleDateString('en-CA')
}

function daysAgoStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

function linearSlope(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const sx  = xs.reduce((a, b) => a + b, 0)
  const sy  = ys.reduce((a, b) => a + b, 0)
  const sxy = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sx2 = xs.reduce((acc, x) => acc + x * x, 0)
  const denom = n * sx2 - sx * sx
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom
}

function formatΔ(d: number | null): string {
  if (d === null) return '—'
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)} kg`
}

function deltaColor(d: number | null): string {
  if (d === null || Math.abs(d) < 0.05) return 'text-gray-700'
  return 'text-gray-700'
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-500' }
  if (bmi < 25)   return { label: 'Normal',      color: 'text-green-600' }
  if (bmi < 30)   return { label: 'Overweight',  color: 'text-orange-500' }
  return              { label: 'Obese',        color: 'text-red-500' }
}

function ratioRating(r: number): { label: string; emoji: string; color: string } {
  if (r < 0.5)  return { label: 'Beginner',     emoji: '🌱', color: 'text-gray-500' }
  if (r < 1.0)  return { label: 'Building',     emoji: '💪', color: 'text-blue-600' }
  if (r < 1.5)  return { label: 'Solid',        emoji: '🔥', color: 'text-orange-500' }
  if (r < 2.0)  return { label: 'Advanced',     emoji: '⚡', color: 'text-purple-600' }
  return              { label: 'Elite',         emoji: '🏆', color: 'text-yellow-600' }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub,
}: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-extrabold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── SVG Weight Chart ──────────────────────────────────────────────────────────

function WeightChart({ data }: { data: WeightLog[] }) {
  if (data.length < 2) return null

  // Chart geometry
  const VW = 340, VH = 132
  const pTop = 8, pRight = 8, pBottom = 28, pLeft = 42
  const cW = VW - pLeft - pRight   // 290
  const cH = VH - pTop - pBottom   // 96

  // Date range: exactly 90 days ending today
  const endDate   = new Date()
  const startDate = new Date(); startDate.setDate(startDate.getDate() - 89)
  const startStr  = startDate.toLocaleDateString('en-CA')

  const totalDays = 89

  const toX = (dateStr: string): number => {
    const days = (new Date(dateStr).getTime() - startDate.getTime()) / 86400000
    return pLeft + Math.min(Math.max(days / totalDays, 0), 1) * cW
  }

  const weights = data.map(d => d.weight_kg)
  const rawMin  = Math.min(...weights)
  const rawMax  = Math.max(...weights)
  const pad     = Math.max((rawMax - rawMin) * 0.15, 0.5)
  const yMin    = rawMin - pad
  const yMax    = rawMax + pad
  const yRange  = yMax - yMin

  const toY = (w: number): number =>
    pTop + ((yMax - w) / yRange) * cH

  // 7-day moving average per point
  const mavg = data.map(d => {
    const cutoff = new Date(d.logged_at); cutoff.setDate(cutoff.getDate() - 6)
    const cutoffStr = cutoff.toLocaleDateString('en-CA')
    const win = data.filter(x => x.logged_at >= cutoffStr && x.logged_at <= d.logged_at)
    return {
      logged_at: d.logged_at,
      avg: win.reduce((a, b) => a + b.weight_kg, 0) / win.length,
    }
  })

  const pts    = data.map(d => `${toX(d.logged_at).toFixed(1)},${toY(d.weight_kg).toFixed(1)}`)
  const mavgPts = mavg.map(d => `${toX(d.logged_at).toFixed(1)},${toY(d.avg).toFixed(1)}`)

  const areaPath = [
    `M ${pts[0]}`,
    ...pts.slice(1).map(p => `L ${p}`),
    `L ${toX(data[data.length - 1].logged_at).toFixed(1)},${(pTop + cH).toFixed(1)}`,
    `L ${pLeft.toFixed(1)},${(pTop + cH).toFixed(1)}`,
    'Z',
  ].join(' ')

  // Y-axis ticks (4 evenly spaced)
  const yTicks: { y: number; label: string }[] = Array.from({ length: 5 }, (_, i) => {
    const w = yMin + (yRange * i) / 4
    return { y: toY(w), label: w.toFixed(1) }
  })

  // Month tick marks on x-axis
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthTicks: { x: number; label: string }[] = []
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1)
  while (cursor <= endDate) {
    monthTicks.push({ x: toX(cursor.toLocaleDateString('en-CA')), label: monthNames[cursor.getMonth()] })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full"
      aria-label="Weight history chart"
    >
      {/* Subtle horizontal grid */}
      {yTicks.map((t, i) => (
        <line key={i} x1={pLeft} y1={t.y} x2={VW - pRight} y2={t.y}
          stroke="#f3f4f6" strokeWidth="1" />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <text key={i} x={pLeft - 5} y={t.y + 3.5} textAnchor="end"
          fontSize="8.5" fill="#9ca3af" fontFamily="system-ui, sans-serif">
          {t.label}
        </text>
      ))}

      {/* Area fill under data line */}
      <path d={areaPath} fill="#bfdbfe" opacity="0.35" />

      {/* Actual data line (light blue) */}
      <polyline
        points={pts.join(' ')}
        fill="none" stroke="#93c5fd" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round"
      />

      {/* 7-day moving average (darker blue, bolder) */}
      <polyline
        points={mavgPts.join(' ')}
        fill="none" stroke="#2563eb" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"
      />

      {/* Data dots */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={toX(d.logged_at)} cy={toY(d.weight_kg)}
          r="2.5" fill="white" stroke="#60a5fa" strokeWidth="1.5"
        />
      ))}

      {/* X-axis month labels */}
      {monthTicks.map((t, i) => (
        <text key={i} x={t.x} y={VH - 4} textAnchor="middle"
          fontSize="8.5" fill="#9ca3af" fontFamily="system-ui, sans-serif">
          {t.label}
        </text>
      ))}

      {/* Legend */}
      <line x1={pLeft} y1={VH - 4} x2={pLeft + 12} y2={VH - 4} stroke="#93c5fd" strokeWidth="1.5" />
      <text x={pLeft + 15} y={VH - 1} fontSize="8" fill="#9ca3af" fontFamily="system-ui, sans-serif">Actual</text>
      <line x1={pLeft + 44} y1={VH - 4} x2={pLeft + 56} y2={VH - 4} stroke="#2563eb" strokeWidth="2" />
      <text x={pLeft + 59} y={VH - 1} fontSize="8" fill="#9ca3af" fontFamily="system-ui, sans-serif">7-day avg</text>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WeightPageClient({ weightLogs, topLifts, heightCm }: Props) {
  const [showForm, setShowForm] = useState(weightLogs.length === 0)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const todayStr = today()

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await logBodyWeight(formData)
      setShowForm(false)
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      await deleteBodyWeightLog(id)
      setDeletingId(null)
    })
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  // weightLogs arrives newest-first from the server; sort asc for computations
  const sorted = [...weightLogs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  const current = sorted.length > 0 ? sorted[sorted.length - 1].weight_kg : null

  const str7  = daysAgoStr(7)
  const str30 = daysAgoStr(30)
  const str90 = daysAgoStr(90)

  const prev7  = sorted.filter(l => l.logged_at <= str7).at(-1)?.weight_kg  ?? null
  const prev30 = sorted.filter(l => l.logged_at <= str30).at(-1)?.weight_kg ?? null
  const change7  = current !== null && prev7  !== null ? current - prev7  : null
  const change30 = current !== null && prev30 !== null ? current - prev30 : null

  const allW  = sorted.map(l => l.weight_kg)
  const minW  = allW.length ? Math.min(...allW) : null
  const maxW  = allW.length ? Math.max(...allW) : null

  const bmi   = current !== null && heightCm ? current / ((heightCm / 100) ** 2) : null
  const bmiCat = bmi !== null ? bmiCategory(bmi) : null

  // Weekly rate via linear regression on last 30 days
  const last30 = sorted.filter(l => l.logged_at >= str30)
  let weeklyRate: number | null = null
  if (last30.length >= 3) {
    const base = new Date(last30[0].logged_at).getTime()
    const xs = last30.map(l => (new Date(l.logged_at).getTime() - base) / 86400000)
    const ys = last30.map(l => l.weight_kg)
    weeklyRate = linearSlope(xs, ys) * 7
  }

  // Chart data: last 90 days, asc
  const chartData = sorted.filter(l => l.logged_at >= str90)

  const hasData = weightLogs.length > 0

  return (
    <div className="space-y-4">

      {/* ── Log button ── */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full bg-black text-white font-bold rounded-xl py-3 text-sm hover:bg-gray-800 active:scale-[0.98] transition-all shadow-sm"
        >
          + Log Weight
        </button>
      )}

      {/* ── Log form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Log Weight</h2>
            {hasData && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xs text-gray-400 hover:text-gray-700 font-semibold transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <form action={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Weight (kg)</label>
                <input
                  name="weight_kg"
                  type="number"
                  step="0.1"
                  min="20"
                  max="350"
                  required
                  defaultValue={current ?? undefined}
                  placeholder="80.5"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
                <input
                  name="logged_at"
                  type="date"
                  defaultValue={todayStr}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Note (optional)</label>
              <input
                name="note"
                type="text"
                placeholder="e.g. morning, post-workout"
                maxLength={100}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-black text-white font-bold rounded-xl py-2.5 text-sm hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}

      {/* ── No data yet ── */}
      {!hasData && !showForm && (
        <p className="text-center text-gray-400 text-sm py-10">
          No entries yet — log your first weight to start tracking!
        </p>
      )}

      {hasData && (
        <>
          {/* ── Stats grid ── */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Current"
              value={current !== null ? `${current.toFixed(1)} kg` : '—'}
              sub={sorted[sorted.length - 1]?.logged_at ?? ''}
            />
            <StatCard
              label="Weekly trend"
              value={weeklyRate !== null
                ? `${weeklyRate >= 0 ? '+' : ''}${weeklyRate.toFixed(2)} kg`
                : '—'}
              sub="per week (30-day avg)"
            />
            <StatCard
              label="7-day change"
              value={formatΔ(change7)}
              sub={prev7 !== null ? `from ${prev7.toFixed(1)} kg` : 'not enough data'}
            />
            <StatCard
              label="30-day change"
              value={formatΔ(change30)}
              sub={prev30 !== null ? `from ${prev30.toFixed(1)} kg` : 'not enough data'}
            />
          </div>

          {/* ── Range bar + BMI ── */}
          {minW !== null && maxW !== null && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">All-time range</p>

              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Low</p>
                  <p className="text-base font-extrabold text-gray-900 leading-none">{minW.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">kg</p>
                </div>

                <div className="flex-1 relative">
                  {/* Track */}
                  <div className="h-2 bg-gray-100 rounded-full" />
                  {/* Current marker */}
                  {current !== null && maxW > minW && (
                    <div
                      className="absolute top-1/2 w-3 h-3 rounded-full bg-gray-900 border-2 border-white shadow"
                      style={{
                        left: `${((current - minW) / (maxW - minW)) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  )}
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-gray-400">High</p>
                  <p className="text-base font-extrabold text-gray-900 leading-none">{maxW.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">kg</p>
                </div>
              </div>

              {/* BMI */}
              {bmi !== null && bmiCat !== null && (
                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">BMI</p>
                    <p className="text-[10px] text-gray-400">
                      based on {heightCm} cm height ·{' '}
                      <Link href="/settings" className="underline hover:text-gray-700">change</Link>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-gray-900 leading-none">{bmi.toFixed(1)}</p>
                    <p className={`text-xs font-semibold ${bmiCat.color}`}>{bmiCat.label}</p>
                  </div>
                </div>
              )}

              {bmi === null && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400">
                    <Link href="/settings" className="font-semibold text-gray-600 hover:text-gray-900 underline">
                      Set your height in Settings
                    </Link>{' '}
                    to see your BMI here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Chart ── */}
          {chartData.length >= 2 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Last 90 days</p>
              <WeightChart data={chartData} />
            </div>
          )}

          {/* ── Strength / BW ratios ── */}
          {current !== null && topLifts.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                Strength / Body Weight
              </p>

              <div className="space-y-3">
                {topLifts.map(lift => {
                  const ratio  = lift.orm / current
                  const rating = ratioRating(ratio)
                  const pct    = Math.min(ratio / 2.5, 1)   // 2.5× = 100% of bar

                  return (
                    <div key={lift.name}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-800 truncate flex-1 pr-2">{lift.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-500 tabular-nums">{lift.orm} kg est. 1RM</span>
                          <span className="text-xs font-bold text-gray-700 tabular-nums">{ratio.toFixed(2)}×</span>
                          <span className={`text-[10px] font-bold ${rating.color} w-20 text-right`}>
                            {rating.emoji} {rating.label}
                          </span>
                        </div>
                      </div>
                      {/* Mini progress bar */}
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gray-300 transition-all"
                          style={{ width: `${(pct * 100).toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
                Best estimated 1RM (Epley) ÷ current body weight.
                Bar shows progress toward 2.5× bodyweight.
              </p>
            </div>
          )}

          {/* ── History list ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">History</p>
            </div>
            <ul className="divide-y divide-gray-50">
              {weightLogs.slice(0, 40).map((log, i) => {
                // Show delta vs previous entry
                const prevIdx = weightLogs.findIndex(l => l.logged_at < log.logged_at)
                const prev = prevIdx !== -1 ? weightLogs[prevIdx].weight_kg : null
                const delta = prev !== null ? log.weight_kg - prev : null

                return (
                  <li key={log.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                          {log.weight_kg.toFixed(1)} kg
                        </span>
                        {delta !== null && (
                          <span className={`text-[10px] font-semibold tabular-nums ${
                            delta > 0.05 ? 'text-orange-400' :
                            delta < -0.05 ? 'text-green-500' :
                            'text-gray-400'
                          }`}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {log.logged_at}
                        {log.note ? ` · ${log.note}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(log.id)}
                      disabled={isPending && deletingId === log.id}
                      className="text-[11px] text-gray-300 hover:text-red-400 transition-colors font-bold shrink-0 p-1 disabled:opacity-40"
                      aria-label="Delete entry"
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
            {weightLogs.length > 40 && (
              <p className="text-center text-xs text-gray-400 py-3">
                Showing most recent 40 entries
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
