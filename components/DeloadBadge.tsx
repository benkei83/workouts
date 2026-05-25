import type { DeloadStatus } from '@/lib/deload'

/**
 * Inline pill shown when an exercise has accumulated failures toward a deload.
 * Pass `compact` for the tight matrix rows in SupersetForm / ProgramGuide.
 */
export default function DeloadBadge({
  status,
  compact = false,
}: {
  status: DeloadStatus
  compact?: boolean
}) {
  const { failures, maxFails, imminent } = status

  if (compact) {
    return (
      <div
        className={`text-[9px] font-bold mt-0.5 truncate ${
          imminent ? 'text-red-400' : 'text-amber-400'
        }`}
      >
        {imminent ? '⚠️ Deload next fail' : `⚠️ ${failures}/${maxFails} fails`}
      </div>
    )
  }

  return (
    <div
      className={`mt-2 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
        imminent
          ? 'bg-red-50 text-red-600 border border-red-100'
          : 'bg-amber-50 text-amber-600 border border-amber-100'
      }`}
    >
      <span>⚠️</span>
      <span>
        {imminent
          ? `Deload on next failure — ${failures}/${maxFails} consecutive`
          : `${failures}/${maxFails} consecutive failures`}
      </span>
    </div>
  )
}
