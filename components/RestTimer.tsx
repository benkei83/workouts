'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  /** Timestamp (Date.now()) when the rest period started. null = not resting. */
  startedAt: number | null
  /** null = count-up mode. Positive integer = countdown from N seconds. */
  defaultSecs: number | null
  /** Trigger a vibration pattern when the countdown reaches zero. */
  vibrateOnComplete: boolean
  /** Play an audio beep when the countdown reaches zero. */
  soundOnComplete: boolean
}

// ─── Web Audio singleton ──────────────────────────────────────────────────────
// We keep one AudioContext alive for the page lifetime. iOS requires that we
// resume() it inside a user-gesture handler; we do that on the first tap/click
// anywhere on the document, well before the beep is needed.
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext()
    } catch {
      return null
    }
  }
  return audioCtx
}

function unlockAudio() {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

// Register unlock listeners once (module-level, client-only)
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true })
  window.addEventListener('click',      unlockAudio, { once: true })
}

/** Two short beeps: 880 Hz (A5), each 180 ms, separated by 80 ms. */
function playBeep() {
  const ctx = getAudioContext()
  if (!ctx || ctx.state !== 'running') return

  const now = ctx.currentTime
  for (let i = 0; i < 2; i++) {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    osc.frequency.value = 880

    const t = now + i * 0.26
    gain.gain.setValueAtTime(0.55, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)

    osc.start(t)
    osc.stop(t + 0.18)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RestTimer({ startedAt, defaultSecs, vibrateOnComplete, soundOnComplete }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const vibratedRef = useRef(false)
  const beeped = useRef(false)

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0)
      vibratedRef.current = false
      beeped.current = false
      return
    }

    vibratedRef.current = false
    beeped.current = false

    const tick = () => {
      const s = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(s)

      // Fire exactly once when countdown expires
      if (defaultSecs !== null && s >= defaultSecs) {
        if (vibrateOnComplete && !vibratedRef.current) {
          vibratedRef.current = true
          try {
            if ('vibrate' in navigator) navigator.vibrate([300, 150, 300])
          } catch { /* ignore */ }
        }
        if (soundOnComplete && !beeped.current) {
          beeped.current = true
          playBeep()
        }
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt, defaultSecs, vibrateOnComplete, soundOnComplete])

  if (startedAt === null) return null

  const isCountdown = defaultSecs !== null
  const remaining   = isCountdown ? defaultSecs - elapsed : null
  const isOvertime  = isCountdown && (remaining ?? 0) < 0
  const isWarning   = isCountdown && !isOvertime && (remaining ?? 99) <= 10

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
