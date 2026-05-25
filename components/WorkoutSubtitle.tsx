'use client'

/**
 * Renders the workout header subtitle using the browser's local timezone.
 * Must be a client component — server-side Date formatting uses UTC on Vercel.
 */
export default function WorkoutSubtitle({
  createdAt,
  isFinished,
  durationMins,
}: {
  createdAt: string
  isFinished: boolean
  durationMins?: number | null
}) {
  const date = new Date(createdAt)

  if (isFinished) {
    const dateString = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return <>{dateString} • {durationMins} mins</>
  }

  const timeString = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return <>Started at {timeString}</>
}
