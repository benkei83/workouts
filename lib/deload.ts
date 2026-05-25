export type DeloadStatus = {
  failures: number
  maxFails: number
  /** true when one more failure will trigger the deload */
  imminent: boolean
}

/**
 * Returns the current deload status for an exercise, or null when:
 * - the exercise has no settings / is on "manual" protocol
 * - zero failures recorded (nothing to warn about)
 */
export function getDeloadStatus(settings: any): DeloadStatus | null {
  if (!settings?.protocol || settings.protocol === 'manual') return null
  const failures = Number(settings.current_failures) || 0
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
 * Returns the current success streak status, or null when:
 * - manual protocol, or min_successes ≤ 1 (streaks irrelevant)
 * - zero successes recorded (streak hasn't started)
 */
export function getSuccessStatus(settings: any): SuccessStatus | null {
  if (!settings?.protocol || settings.protocol === 'manual') return null
  const minSuccesses = Number(settings.min_successes) || 1
  if (minSuccesses <= 1) return null
  const successes = Number(settings.current_successes) || 0
  if (successes === 0) return null
  return { successes, minSuccesses, imminent: successes >= minSuccesses - 1 }
}
