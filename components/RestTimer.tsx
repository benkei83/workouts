'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  /** Timestamp (Date.now()) when the rest period started. null = not resting. */
  startedAt: number | null
  /** null = count-up mode. Positive integer = countdown from N seconds. */
  defaultSecs: number | null
  /** Trigger a vibration pattern when the countdown reaches zero. */
  vibrateOnComplete: boolean
}

export default function RestTimer({ startedAt, defaultSecs, vibrateOnComplete }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const vibratedRef = useRef(false)

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0)
      vibratedRef.current = false
      return
    }

    vibratedRef.current = false

    const tick = () => {
      const s = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(s)

      // Fire vibration exactly once when countdown expires
      if (
        defaultSecs !== null &&
        s >= defaultSecs &&
        !vibratedRef.current
      ) {
        vibratedRef.current = true
        if (vibrateOnComplete) {
          try {
            if ('vibrate' in navigator) {
              navigator.vibrate([300, 150, 300])
            }
          } catch { /* ignore — some browsers throw on vibrate() */ }
        }
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt, defaultSecs, vibrateOnComplete])

  if (startedAt === null) return null

  const isCountdown = defaultSecs !== null
  const remaining   = isCountdown ? defaultSecs - elapsed : null
  const isOvertime  = isCountdown && (remaining ?? 0) < 0
  const isWarning   = isCountdown && !isOvertime && (remaining ?? 99) <= 10

  // Seconds to display (abs value — overtime prefix is shown separately)
  const displaySecs = isCountdown ? Math.abs(remaining ?? 0) : elapsed
  const m   = Math.floor(displaySecs / 60)
  const sec = displaySecs % 60
  const timeStr = `${m}:${sec.toString().padStart(2, '0')}`

  const bgClass    = isOvertime ? 'bg-red-50   border-red-100'    : isWarning ? 'bg-amber-50 border-amber-100' : 'bg-blue-50  border-blue-100'
  const labelColor = isOvertime ? 'text-red-400'   : isWarning ? 'text-amber-400' : 'text-blue-400'
  const timeColor  = isOvertime ? 'text-red-600'   : isWarning ? 'text-amber-500' : 'text-blue-600'
  const icon       = isOvertime ? '🚀' : '⏱️'
  const label      = isCountdown
    ? (isOvertime ? 'Overtime' : 'Rest')
    : 'Rest timer'

  return (
    <div className={`flex items-center justify-between border rounded-xl px-4 py-3 mb-3 transition-colors ${bgClass}`}>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</p>
        <p className={`text-3xl font-extrabold tabular-nums leading-none mt-0.5 ${timeColor}`}>
          {isOvertime && <span className="text-xl">+</span>}
          {timeStr}
        </p>
      </div>
      <span className="text-3xl select-none">{icon}</span>
    </div>
  )
}
