'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { finishWorkoutWithFeel } from '@/app/workout/actions'
import WorkoutFeelModal from '@/components/WorkoutFeelModal'
import type { Intensity } from '@/components/WorkoutFeelModal'

export default function FinishWorkoutButton({ workoutId }: { workoutId: string }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleFinish = (rating: number | null, intensity: Intensity | null) => {
    startTransition(async () => {
      await finishWorkoutWithFeel(workoutId, rating, intensity)
      router.refresh()
      router.push('/')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors shadow-sm active:scale-95"
      >
        Finish
      </button>

      {showModal && (
        <WorkoutFeelModal
          initialRating={0}
          initialIntensity={null}
          submitLabel="Save & Finish"
          submitStyle="green"
          isPending={isPending}
          onSubmit={handleFinish}
          onSkip={() => handleFinish(null, null)}
        />
      )}
    </>
  )
}
