'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function WorkoutTimer({
  startedAt,
  workoutId,
}: {
  startedAt: string
  workoutId: string
}) {
  const [elapsed, setElapsed] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Tick every second; honours any localStorage reset point
  useEffect(() => {
    const base = new Date(startedAt).getTime()

    const getStart = () => {
      try {
        const stored = localStorage.getItem(`timer-reset-${workoutId}`)
        if (stored) return Math.max(base, Number(stored))
      } catch {}
      return base
    }

    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - getStart()) / 1000)))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt, workoutId])

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const handleReset = () => {
    try {
      localStorage.setItem(`timer-reset-${workoutId}`, Date.now().toString())
    } catch {}
    setElapsed(0)
    setShowMenu(false)
  }

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const display =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div ref={menuRef} className="pointer-events-auto flex flex-col items-center">
        {/* Pill — click toggles the dropdown */}
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1.5 rounded-b-xl shadow-lg hover:bg-black/90 transition-colors tabular-nums"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          {display}
        </button>

        {/* Dropdown */}
        {showMenu && (
          <div className="mt-0.5 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden text-sm min-w-[160px]">
            <Link
              href={`/workout/${workoutId}`}
              onClick={() => setShowMenu(false)}
              className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700 font-medium"
            >
              <span>↗</span> Open workout
            </Link>
            <div className="border-t border-gray-100" />
            <button
              onClick={handleReset}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-gray-500 font-medium"
            >
              <span>⏱</span> Reset timer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
