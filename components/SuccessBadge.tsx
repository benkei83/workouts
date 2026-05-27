import type { SuccessStatus } from '@/lib/deload'

/**
 * Inline indicator shown when an exercise has an active consecutive-success streak.
 * Only appears when min_successes > 1 and current_successes > 0.
 * Pass `compact` for matrix rows in SupersetForm / ProgramGuide.
 */
export default function SuccessBadge({
  status,
  compact = false,
}: {
  status: SuccessStatus
  compact?: boolean
}) {
  const { successes, minSuccesses, imminent } = status

  if (compact) {
    return (
      <div
        className={`text-[9px] font-bold mt-0.5 truncate ${
          imminent ? 'text-emerald-400' : 'text-green-500'
        }`}
      >
        {imminent ? `🎯 One more → increment! (${successes}/${minSuccesses})` : `✓ ${successes}/${minSuccesses} successes`}
      </div>
    )
  }

  return (
    <div
      className={`mt-2 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
        imminent
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          : 'bg-green-50 text-green-700 border border-green-100'
      }`}
    >
      <span>{imminent ? '🎯' : '✓'}</span>
      <span>
        {imminent
          ? `One more success → weight increases (${successes}/${minSuccesses})`
          : `${successes}/${minSuccesses} consecutive successes`}
      </span>
    </div>
  )
}
