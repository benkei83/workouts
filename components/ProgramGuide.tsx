'use client'

import { useState } from 'react'
import { saveStrengthExercise, advanceRotation } from '@/app/workout/actions'

type SetData = { weight: number; reps: number }
type Exercise = { id: string; name: string; settings?: any; increment_step?: number }
type ProgramExercise = { id: string; exercise_id: string; sort_order: number; exercises: { id: string; name: string } }
type ProgramWorkout = { id: string; name: string; rotation_order: number; program_exercises: ProgramExercise[] }
type Program = { id: string; name: string; program_workouts: ProgramWorkout[] }

export default function ProgramGuide({
  workoutId,
  program,
  dayIndex,
  exercises,
  onComplete,
}: {
  workoutId: string
  program: Program
  dayIndex: number
  exercises: Exercise[]
  onComplete: () => void
}) {
  const days = [...(program.program_workouts || [])].sort((a, b) => a.rotation_order - b.rotation_order)
  const totalDays = days.length
  const today = days[dayIndex] || days[0]
  const programExercises = [...(today?.program_exercises || [])].sort((a, b) => a.sort_order - b.sort_order)

  const buildSets = (exerciseId: string): SetData[] => {
    const ex = exercises.find(e => e.id === exerciseId)
    const sets = ex?.settings?.target_sets || 3
    const reps = ex?.settings?.target_reps || 8
    const weight = ex?.settings?.current_weight || 60
    return Array.from({ length: sets }, () => ({ weight, reps }))
  }

  const [step, setStep] = useState(0)
  const [sets, setSets] = useState<SetData[]>(() => buildSets(programExercises[0]?.exercise_id))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())

  const currentPE = programExercises[step]
  const currentExercise = exercises.find(e => e.id === currentPE?.exercise_id)
  const increment = currentExercise?.increment_step || 2.5
  const isLast = step === programExercises.length - 1
  const nextIndex = (dayIndex + 1) % totalDays

  const updateSet = (index: number, field: 'weight' | 'reps', delta: number) => {
    setSets(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: Math.max(0, next[index][field] + delta) }
      return next
    })
  }

  const addSet = () => {
    const last = sets[sets.length - 1] || { weight: 60, reps: 8 }
    setSets([...sets, { ...last }])
  }

  const removeSet = (i: number) => setSets(sets.filter((_, idx) => idx !== i))

  const advance = (nextStep: number) => {
    setStep(nextStep)
    setSets(buildSets(programExercises[nextStep]?.exercise_id))
  }

  const logAndContinue = async (finish: boolean) => {
    setIsSubmitting(true)

    if (!skipped.has(step)) {
      await saveStrengthExercise(workoutId, currentPE.exercise_id, sets)
    }

    if (finish) {
      await advanceRotation(program.id, nextIndex)
      onComplete()
    } else {
      advance(step + 1)
    }

    setIsSubmitting(false)
  }

  const skipExercise = () => {
    setSkipped(prev => new Set(prev).add(step))
    if (isLast) {
      advanceRotation(program.id, nextIndex).then(onComplete)
    } else {
      advance(step + 1)
    }
  }

  if (programExercises.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center space-y-4">
        <p className="text-gray-500 font-medium">This workout day has no exercises. Add some in Programs first.</p>
        <button onClick={onComplete} className="bg-black text-white font-bold rounded-xl py-3 px-6">
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="bg-black text-white px-5 py-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{program.name}</p>
            <h2 className="text-lg font-extrabold mt-0.5">{today.name}</h2>
          </div>
          <button onClick={onComplete} className="text-gray-400 hover:text-white font-bold p-1 text-sm transition-colors">
            ✕ Exit
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
            <span>Exercise {step + 1} of {programExercises.length}</span>
            <span>{Math.round(((step) / programExercises.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${((step) / programExercises.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Exercise name */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Now lifting</p>
          <h3 className="text-2xl font-extrabold text-gray-900">{currentExercise?.name || 'Unknown Exercise'}</h3>
        </div>

        {/* Sets */}
        <div className="space-y-2">
          {sets.map((set, i) => (
            <div key={i} className="flex items-center justify-between gap-1 bg-gray-50 p-2 rounded-xl border border-gray-100 relative group">
              {sets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSet(i)}
                  className="absolute -left-2 -top-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm"
                >
                  ✕
                </button>
              )}
              <div className="font-bold text-gray-400 w-4 text-center text-sm">{i + 1}</div>

              <div className="flex items-center bg-white rounded-lg border border-gray-200">
                <button type="button" onClick={() => updateSet(i, 'weight', -increment)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
                <div className="text-center w-12 leading-tight">
                  <div className="font-bold text-gray-900">{Number(set.weight.toFixed(2))}</div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">kg</div>
                </div>
                <button type="button" onClick={() => updateSet(i, 'weight', increment)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
              </div>

              <div className="text-gray-300 font-bold text-sm px-1">×</div>

              <div className="flex items-center bg-white rounded-lg border border-gray-200">
                <button type="button" onClick={() => updateSet(i, 'reps', -1)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
                <div className="text-center w-10 leading-tight">
                  <div className="font-bold text-gray-900">{set.reps}</div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">reps</div>
                </div>
                <button type="button" onClick={() => updateSet(i, 'reps', 1)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addSet}
          className="w-full border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-xl py-2.5 hover:border-black transition-colors text-sm"
        >
          + Add Set
        </button>

        {/* Primary action */}
        <button
          type="button"
          onClick={() => logAndContinue(isLast)}
          disabled={isSubmitting}
          className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isSubmitting
            ? 'Saving...'
            : isLast
            ? 'Log & Finish Program'
            : 'Log & Next Exercise'}
        </button>

        {/* Skip */}
        <button
          type="button"
          onClick={skipExercise}
          disabled={isSubmitting}
          className="w-full text-sm text-gray-400 hover:text-gray-700 font-semibold py-1 transition-colors"
        >
          Skip this exercise
        </button>
      </div>

      {/* Exercise queue */}
      {programExercises.length > 1 && (
        <div className="border-t border-gray-100 px-5 py-3 flex gap-2 overflow-x-auto">
          {programExercises.map((pe, i) => {
            const ex = exercises.find(e => e.id === pe.exercise_id)
            return (
              <div
                key={pe.id}
                className={`flex-shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors ${
                  i === step
                    ? 'bg-black text-white'
                    : i < step
                    ? skipped.has(i)
                      ? 'bg-gray-100 text-gray-400 line-through'
                      : 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {ex?.name || 'Exercise'}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
