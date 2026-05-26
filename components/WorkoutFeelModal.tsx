'use client'

import { useState } from 'react'

export const INTENSITY_OPTIONS = [
  { value: 'light',     label: 'Light',     emoji: '🌿', desc: 'Easy, active recovery' },
  { value: 'medium',    label: 'Medium',    emoji: '🏃', desc: 'Moderate effort' },
  { value: 'heavy',     label: 'Heavy',     emoji: '💪', desc: 'High effort, grinding' },
  { value: 'explosive', label: 'Explosive', emoji: '⚡', desc: 'Fast, power-focused' },
] as const

export type Intensity = typeof INTENSITY_OPTIONS[number]['value']

const STAR_LABELS: Record<number, string> = {
  1: 'Awful',
  2: 'Bad',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
  6: 'Perfect',
}

type Props = {
  initialRating: number
  initialIntensity: Intensity | null
  /** Primary action label — "Save & Finish" or "Save" */
  submitLabel: string
  /** Primary action style — green (finish) or black (edit) */
  submitStyle?: 'green' | 'black'
  isPending: boolean
  /** Called with the selected values when primary button is pressed */
  onSubmit: (rating: number | null, intensity: Intensity | null) => void
  /** If provided, shows a "Skip" link instead of a close button */
  onSkip?: () => void
  /** If provided, shows an ✕ close button */
  onClose?: () => void
}

export default function WorkoutFeelModal({
  initialRating,
  initialIntensity,
  submitLabel,
  submitStyle = 'black',
  isPending,
  onSubmit,
  onSkip,
  onClose,
}: Props) {
  const [rating, setRating]       = useState(initialRating)
  const [hovered, setHovered]     = useState(0)
  const [intensity, setIntensity] = useState<Intensity | null>(initialIntensity)

  const display = hovered || rating

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
        <div className="p-6">

          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-xl font-extrabold text-gray-900">How was your workout?</h2>
            {onClose && (
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold p-1 -mt-1 -mr-1">✕</button>
            )}
          </div>
          <p className="text-sm text-gray-400 mb-6">
            {display > 0 ? STAR_LABELS[display] : 'Tap to rate this session'}
          </p>

          {/* ── Stars ──────────────────────────────────────── */}
          <div className="flex justify-center gap-2 mb-7">
            {[1, 2, 3, 4, 5, 6].map(star => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star === rating ? 0 : star)}
                className="transition-transform active:scale-90 hover:scale-110 leading-none"
                title={STAR_LABELS[star]}
              >
                <span className={`text-4xl select-none ${display >= star ? 'text-yellow-400' : 'text-gray-200'}`}>
                  ★
                </span>
              </button>
            ))}
          </div>

          {/* ── Intensity ──────────────────────────────────── */}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center mb-3">
            Intensity
          </p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {INTENSITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntensity(intensity === opt.value ? null : opt.value)}
                className={`flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl font-bold text-sm border-2 transition-all active:scale-95 ${
                  intensity === opt.value
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-xs font-bold">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* ── Actions ────────────────────────────────────── */}
          <button
            type="button"
            onClick={() => onSubmit(rating || null, intensity)}
            disabled={isPending}
            className={`w-full font-bold rounded-xl py-4 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 ${
              submitStyle === 'green'
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
          >
            {isPending ? 'Saving…' : submitLabel}
          </button>

          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={isPending}
              className="w-full text-gray-400 text-sm font-semibold py-3 hover:text-gray-700 transition-colors disabled:opacity-60"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
