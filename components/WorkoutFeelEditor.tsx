'use client'

import { useState, useTransition } from 'react'
import { saveWorkoutFeel } from '@/app/workout/actions'
import WorkoutFeelModal, { INTENSITY_OPTIONS } from '@/components/WorkoutFeelModal'
import type { Intensity } from '@/components/WorkoutFeelModal'

export default function WorkoutFeelEditor({
  workoutId,
  initialFeelRating,
  initialIntensity,
}: {
  workoutId: string
  initialFeelRating: number | null
  initialIntensity: string | null
}) {
  const [showModal, setShowModal]   = useState(false)
  // Optimistic local state so the display updates instantly after saving
  const [rating, setRating]         = useState(initialFeelRating)
  const [intensity, setIntensity]   = useState<Intensity | null>(initialIntensity as Intensity | null)
  const [isPending, startTransition] = useTransition()

  const handleSave = (newRating: number | null, newIntensity: Intensity | null) => {
    startTransition(async () => {
      await saveWorkoutFeel(workoutId, newRating, newIntensity)
      setRating(newRating)
      setIntensity(newIntensity)
      setShowModal(false)
    })
  }

  const intensityOption = INTENSITY_OPTIONS.find(o => o.value === intensity)
  const hasData = rating || intensity

  return (
    <>
      {/* ── Display / trigger ── */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`w-full flex items-center gap-3 bg-white border rounded-xl px-4 py-3 hover:border-gray-300 transition-colors text-left group ${
          hasData ? 'border-gray-100 shadow-sm' : 'border-dashed border-gray-200'
        }`}
      >
        {hasData ? (
          <>
            {/* Stars */}
            {rating && (
              <div className="flex gap-0.5 shrink-0">
                {[1, 2, 3, 4, 5, 6].map(s => (
                  <span key={s} className={`text-base ${s <= rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
            )}
            {/* Intensity chip */}
            {intensityOption && (
              <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                {intensityOption.emoji} {intensityOption.label}
              </span>
            )}
            <span className="text-[11px] text-gray-300 group-hover:text-gray-400 ml-auto transition-colors">
              Edit ✏️
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-400">+ Rate this session</span>
        )}
      </button>

      {/* ── Edit modal ── */}
      {showModal && (
        <WorkoutFeelModal
          initialRating={rating ?? 0}
          initialIntensity={intensity}
          submitLabel="Save"
          submitStyle="black"
          isPending={isPending}
          onSubmit={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
