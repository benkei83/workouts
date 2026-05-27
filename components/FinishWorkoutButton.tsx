'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { finishWorkoutWithFeel } from '@/app/workout/actions'
import WorkoutFeelModal from '@/components/WorkoutFeelModal'
import TrophyToast from '@/components/TrophyToast'
import type { Intensity } from '@/components/WorkoutFeelModal'
import type { TrophyUnlock } from '@/lib/trophies/types'

export default function FinishWorkoutButton({
  workoutId,
  showTrophyToast = true,
}: {
  workoutId: string
  showTrophyToast?: boolean
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingTrophies, setPendingTrophies] = useState<TrophyUnlock[]>([])

  const handleFinish = (rating: number | null, intensity: Intensity | null) => {
    setShowModal(false)
    startTransition(async () => {
      const result = await finishWorkoutWithFeel(workoutId, rating, intensity)
      // Signal WorkoutTimer to stop immediately — no router refresh required
      window.dispatchEvent(new CustomEvent(`workout-finished:${workoutId}`))
      if (showTrophyToast && result.newTrophies && result.newTrophies.length > 0) {
        // Show trophies first; navigation happens after they're dismissed
        setPendingTrophies(result.newTrophies)
      } else {
        router.refresh()
        router.push('/')
      }
    })
  }

  const handleTrophiesDone = () => {
    setPendingTrophies([])
    router.refresh()
    router.push('/')
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

      {pendingTrophies.length > 0 && (
        <TrophyToast
          trophies={pendingTrophies}
          onDone={handleTrophiesDone}
        />
      )}
    </>
  )
}
