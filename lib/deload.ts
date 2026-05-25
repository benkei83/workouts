import type { ComputedStreak } from '@/lib/streaks'

export type DeloadStatus = {
  failures: number
  maxFails: number
  /** true when one more failure will trigger the deload */
  imminent: boolean
}

/**
 * Returns deload status for display.
 * Pass `streak` (computed from logs) to override the stored counter — preferred.
 * Falls back to settings.current_failures when streak is omitted.
 */
export function getDeloadStatus(settings: any, streak?: ComputedStreak): DeloadStatus | null {
  if (!settings?.protocol || settings.protocol === 'manual') return null
  const failures = streak !== undefined
    ? (streak?.type === 'failure' ? streak.count : 0)
    : (Number(settings.current_failures) || 0)
  const maxFails = Number(settings.max_failures) || 3
  if (failures === 0) return null
  return { failures, maxFails, imminent: failures >= maxFails - 1 }
}

export type SuccessStatus = {
  successes: number
  minSuccesses: number
  /** true when one more success will trigger a weight increment */
  imminent: boolean
}

/**
 * Returns success streak status for display.
 * When `streak` is provided: shows any non-zero success streak for non-manual protocols.
 * Without `streak`: only shows when min_successes > 1 (legacy behaviour).
 */
export function getSuccessStatus(settings: any, streak?: ComputedStreak): SuccessStatus | null {
  if (!settings?.protocol || settings.protocol === 'manual') return null
  const minSuccesses = Number(settings.min_successes) || 1

  if (streak !== undefined) {
    const successes = streak?.type === 'success' ? streak.count : 0
    if (successes === 0) return null
    return { successes, minSuccesses, imminent: successes >= minSuccesses - 1 }
  }

  // Fallback (no computed streak) — suppress when min_successes ≤ 1
  if (minSuccesses <= 1) return null
  const successes = Number(settings.current_successes) || 0
  if (successes === 0) return null
  return { successes, minSuccesses, imminent: successes >= minSuccesses - 1 }
}

export type MaintenanceStatus = { count: number }

/**
 * Returns maintenance streak status — only relevant for double progression.
 * Requires a computed streak (always log-based, never stored).
 */
export function getMaintenanceStatus(settings: any, streak?: ComputedStreak): MaintenanceStatus | null {
  if (settings?.protocol !== 'double') return null
  const count = streak?.type === 'maintenance' ? streak.count : 0
  if (count === 0) return null
  return { count }
}
