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
