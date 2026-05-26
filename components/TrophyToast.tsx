'use client'

import { useState, useEffect } from 'react'
import type { TrophyUnlock } from '@/lib/trophies/types'
import { CATEGORY_EMOJI } from '@/lib/trophies/types'

interface Props {
  trophies: TrophyUnlock[]
  onDone: () => void
}

export default function TrophyToast({ trophies, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  // Animate in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  if (trophies.length === 0) {
    onDone()
    return null
  }

  const current = trophies[index]
  const isLast = index === trophies.length - 1

  const advance = () => {
    if (isLast) {
      setVisible(false)
      setTimeout(onDone, 300)
    } else {
      setIndex((i) => i + 1)
    }
  }

  const skipAll = () => {
    setVisible(false)
    setTimeout(onDone, 300)
  }

  const tierColors: Record<number, { bg: string; border: string; badge: string }> = {
    1: { bg: 'from-amber-50 to-orange-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700'  },
    2: { bg: 'from-slate-50 to-gray-100',   border: 'border-slate-300',  badge: 'bg-slate-200 text-slate-700'  },
    3: { bg: 'from-yellow-50 to-amber-50',  border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-700' },
    4: { bg: 'from-indigo-50 to-purple-50', border: 'border-indigo-300', badge: 'bg-indigo-100 text-indigo-700' },
  }
  const colors = tierColors[current.tier] ?? tierColors[1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={skipAll}
      />

      {/* Card */}
      <div
        className={`
          relative w-full max-w-sm rounded-2xl border-2 p-6
          bg-gradient-to-br ${colors.bg} ${colors.border}
          shadow-2xl
          transition-all duration-300
          ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}
        `}
      >
        {/* Skip all */}
        {trophies.length > 1 && (
          <button
            onClick={skipAll}
            className="absolute top-3 right-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip all
          </button>
        )}

        {/* Counter */}
        {trophies.length > 1 && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            {index + 1} / {trophies.length}
          </p>
        )}

        {/* Trophy header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="text-5xl leading-none select-none">{current.tierEmoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.badge}`}>
                {current.tierLabel}
              </span>
              <span className="text-xs text-gray-400">
                {CATEGORY_EMOJI[current.trophy.category]} {current.trophy.category}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium leading-snug">
              {current.trophy.tiers[current.tier - 1].description}
            </p>
          </div>
        </div>

        {/* Quote */}
        <blockquote className="border-l-2 border-gray-300 pl-3 mb-6">
          <p className="text-base font-semibold text-gray-800 leading-snug italic">
            "{current.trophy.quote}"
          </p>
          {current.trophy.attribution && (
            <footer className="text-xs text-gray-500 mt-1 font-medium not-italic">
              {current.trophy.attribution}
            </footer>
          )}
        </blockquote>

        {/* CTA */}
        <button
          onClick={advance}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gray-900 text-white hover:bg-gray-700 active:scale-95 transition-all"
        >
          {isLast ? '🏆 Let\'s go!' : 'Nice! →'}
        </button>
      </div>
    </div>
  )
}
