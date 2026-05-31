'use client'

// Pure display — no interactivity, so 'use client' is optional but kept for
// potential future hover states without changing the import chain.

type Settings = {
  protocol?: string | null
  current_weight?: number | null
  target_sets?: number | null
  target_reps?: number | null
  target_reps_min?: number | null
  progression_rate?: number | null
  deload_multiplier?: number | null
  current_successes?: number | null
  current_failures?: number | null
  min_successes?: number | null
  max_failures?: number | null
  [key: string]: any
}

function Dot({ filled, red }: { filled: boolean; red: boolean }) {
  return (
    <div className={`w-3 h-3 rounded-full transition-colors ${
      filled
        ? red ? 'bg-red-400' : 'bg-green-500'
        : 'bg-gray-200'
    }`} />
  )
}

import type { ProgressionHistory as PH } from '@/lib/stats/compute'
type ProgressionHistory = PH | null

export default function ProgressionCard({
  setting,
  history = null,
}: {
  setting:  Settings | null
  history?: ProgressionHistory
}) {
  if (!setting?.protocol || setting.protocol === 'manual') return null

  const protocol      = setting.protocol
  const currentWeight = Number(setting.current_weight)   || 0
  const progRate      = Number(setting.progression_rate) || 2.5
  const deloadMult    = Number(setting.deload_multiplier)|| 2.0
  const targetSets    = Number(setting.target_sets)      || 5
  const targetReps    = Number(setting.target_reps)      || 5
  const targetRepsMin = Number(setting.target_reps_min)  || 8
  const minSucc       = Math.max(1, Number(setting.min_successes)  || 1)
  const maxFail       = Math.max(1, Number(setting.max_failures)   || 3)
  const successes     = Number(setting.current_successes)|| 0
  const failures      = Number(setting.current_failures) || 0

  const hasFailures  = failures > 0
  const nextWeight   = Math.round((currentWeight + progRate) * 100) / 100
  const deloadWeight = Math.max(0, Math.round((currentWeight - progRate * deloadMult) * 100) / 100)

  // Dots track either successes or failures
  const dotsTotal  = hasFailures ? maxFail  : minSucc
  const dotsFilled = hasFailures ? failures : successes

  const isDouble = protocol === 'double'

  // Footer line describes what "a qualifying session" means
  const footerText = isDouble
    ? `Rep range ${targetRepsMin}–${targetReps} · +${progRate}kg per step`
    : `Target ${targetSets} × ${targetReps} reps · +${progRate}kg per step`

  const headerLabel = hasFailures
    ? 'Deload warning'
    : isDouble ? 'Double Progression' : 'Linear Progression'

  const accentBg     = hasFailures ? 'bg-red-50   border-red-100'   : 'bg-white border-gray-100'
  const accentHeader = hasFailures ? 'text-red-500'                  : 'text-gray-400'
  const accentIcon   = hasFailures ? 'text-red-400'                  : 'text-green-500'
  const accentLeft   = hasFailures ? 'text-red-700'                  : 'text-gray-900'
  const accentRight  = hasFailures ? 'text-red-400'                  : 'text-green-600'
  const accentDivider= hasFailures ? 'bg-red-100'                    : 'bg-gray-100'
  const accentLabel  = hasFailures ? 'text-red-500'                  : 'text-gray-500'

  return (
    <div className={`rounded-2xl p-5 border shadow-sm ${accentBg}`}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <span className={`text-sm ${accentIcon}`}>{hasFailures ? '⚠' : '↑'}</span>
        <p className={`text-sm font-bold uppercase tracking-wider ${accentHeader}`}>{headerLabel}</p>
      </div>

      {/* Journey row */}
      <div className="flex items-center justify-between gap-2">

        {/* Left: current weight */}
        <div className="text-center min-w-[56px]">
          <p className={`text-2xl font-extrabold leading-none ${accentLeft}`}>{currentWeight}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">current</p>
        </div>

        {/* Centre: dots + label */}
        <div className="flex flex-col items-center gap-2 flex-1 px-2">
          <div className="flex items-center gap-2 justify-center flex-wrap">
            {Array.from({ length: dotsTotal }).map((_, i) => (
              <Dot key={i} filled={i < dotsFilled} red={hasFailures} />
            ))}
          </div>
          <p className={`text-[11px] font-semibold ${accentLabel}`}>
            {dotsFilled}/{dotsTotal} {hasFailures ? 'failures' : 'sessions'}
          </p>
        </div>

        {/* Right: next / deload weight */}
        <div className="text-center min-w-[56px]">
          <p className={`text-2xl font-extrabold leading-none ${accentRight}`}>
            {hasFailures ? deloadWeight : nextWeight}
          </p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
            {hasFailures ? 'if deload' : 'next'}
          </p>
        </div>

      </div>

      {/* Divider */}
      <div className={`h-px my-4 ${accentDivider}`} />

      {/* Footer: protocol description + history stats */}
      <p className="text-[11px] text-gray-400 font-medium mb-3">{footerText}</p>

      {history && history.totalProgressions + history.totalDeloads > 0 ? (
        <div className="flex items-center gap-3 flex-wrap">
          {history.totalProgressions > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-green-500 text-xs font-bold">↑</span>
              <span className="text-xs font-bold text-gray-700">{history.totalProgressions}</span>
              <span className="text-[11px] text-gray-400">progressions</span>
            </div>
          )}
          {history.totalProgressions > 0 && history.totalDeloads > 0 && (
            <div className="w-px h-3 bg-gray-200" />
          )}
          {history.totalDeloads > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-red-400 text-xs font-bold">↓</span>
              <span className="text-xs font-bold text-gray-700">{history.totalDeloads}</span>
              <span className="text-[11px] text-gray-400">deloads</span>
            </div>
          )}
          {history.increaseStreak > 1 && (
            <>
              <div className="w-px h-3 bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 text-xs">🔥</span>
                <span className="text-xs font-bold text-gray-700">{history.increaseStreak}×</span>
                <span className="text-[11px] text-gray-400">streak</span>
              </div>
            </>
          )}
        </div>
      ) : history ? (
        <p className="text-[11px] text-gray-300 italic">No progressions recorded yet</p>
      ) : null}

    </div>
  )
}
