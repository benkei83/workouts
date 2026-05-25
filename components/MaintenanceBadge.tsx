import type { MaintenanceStatus } from '@/lib/deload'

/**
 * Shown when a double-progression exercise is in the maintenance zone
 * (all sets within the rep range, but not yet hitting the upper target).
 */
export default function MaintenanceBadge({
  status,
  compact = false,
}: {
  status: MaintenanceStatus
  compact?: boolean
}) {
  const { count } = status

  if (compact) {
    return (
      <div className="text-[9px] font-bold mt-0.5 text-blue-400 truncate">
        🔄 {count}× in range
      </div>
    )
  }

  return (
    <div className="mt-2 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100">
      <span>🔄</span>
      <span>
        {count === 1
          ? 'In the rep range — push for the top end!'
          : `${count} sessions in range — keep pushing the reps!`}
      </span>
    </div>
  )
}
