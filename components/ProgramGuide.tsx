'use client'

import { useState } from 'react'
import { saveStrengthExercise, saveSupersetLog, advanceRotation } from '@/app/workout/actions'

type SetData = { weight: number; reps: number }
type LastSession = { date: string; sets: { weight: number; reps: number }[] }
type Exercise = { id: string; name: string; settings?: any; increment_step?: number; lastSession?: LastSession | null }

type SupersetTemplateExercise = {
  sort_order: number
  exercise_id: string
  exercises: { id: string; name: string }
}

type SupersetTemplate = {
  id: string
  name: string
  superset_template_exercises: SupersetTemplateExercise[]
}

type ProgramExercise = {
  id: string
  exercise_id: string | null
  sort_order: number
  exercises: { id: string; name: string } | null
  superset_template_id?: string | null
  superset_templates?: SupersetTemplate | null
}
type ProgramWorkout = { id: string; name: string; rotation_order: number; program_exercises: ProgramExercise[] }
type Program = { id: string; name: string; program_workouts: ProgramWorkout[] }

// Matrix for superset steps: exerciseId → sets
type SupersetMatrix = Record<string, SetData[]>

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

  // ── Helpers ──────────────────────────────────────────────

  const buildSets = (exerciseId: string | null | undefined): SetData[] => {
    if (!exerciseId) return Array.from({ length: 3 }, () => ({ weight: 0, reps: 0 }))
    const ex = exercises.find(e => e.id === exerciseId)
    const count = ex?.settings?.target_sets || 3
    const reps = ex?.settings?.target_reps || 8
    const weight = ex?.settings?.current_weight || 0
    return Array.from({ length: count }, () => ({ weight, reps }))
  }

  const buildSupersetMatrix = (pe: ProgramExercise): SupersetMatrix => {
    const tes = [...(pe.superset_templates?.superset_template_exercises || [])].sort((a, b) => a.sort_order - b.sort_order)
    const matrix: SupersetMatrix = {}
    tes.forEach(te => {
      const ex = exercises.find(e => e.id === te.exercise_id)
      const weight = ex?.settings?.current_weight ?? 0
      const reps = ex?.settings?.target_reps ?? 0
      // Use 3 sets for supersets unless first exercise has a target_sets setting
      const count = ex?.settings?.target_sets ?? 3
      matrix[te.exercise_id] = Array.from({ length: count }, () => ({ weight, reps }))
    })
    return matrix
  }

  // ── State ────────────────────────────────────────────────

  const firstPE = programExercises[0]
  const firstIsSuperset = !!firstPE?.superset_template_id

  const [step, setStep] = useState(0)
  const [setsMap, setSetsMap] = useState<Record<number, SetData[]>>(
    firstIsSuperset
      ? ({} as Record<number, SetData[]>)
      : { 0: buildSets(firstPE?.exercise_id) }
  )
  const [supersetMap, setSupersetMap] = useState<Record<number, SupersetMatrix>>(
    firstIsSuperset
      ? { 0: buildSupersetMatrix(firstPE) }
      : ({} as Record<number, SupersetMatrix>)
  )
  const [logged, setLogged] = useState<Set<number>>(new Set())
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Derived values ───────────────────────────────────────

  const currentPE = programExercises[step]
  const isSuperset = !!currentPE?.superset_template_id
  const currentExercise = isSuperset ? null : exercises.find(e => e.id === currentPE?.exercise_id)
  const increment = currentExercise?.increment_step || 2.5
  const isFirst = step === 0
  const isLast = step === programExercises.length - 1
  const nextRotationIndex = (dayIndex + 1) % totalDays

  // Current sets for single-exercise steps
  const currentSets: SetData[] = setsMap[step] ?? buildSets(currentPE?.exercise_id)

  // Current matrix for superset steps
  const currentMatrix: SupersetMatrix = supersetMap[step] ?? buildSupersetMatrix(currentPE)

  // Sorted superset exercises for current step
  const supersetExercises = isSuperset
    ? [...(currentPE.superset_templates?.superset_template_exercises || [])].sort((a, b) => a.sort_order - b.sort_order)
    : []

  // ── Update helpers ───────────────────────────────────────

  const updateSetsMap = (updater: (prev: SetData[]) => SetData[]) => {
    setSetsMap(prev => ({ ...prev, [step]: updater(prev[step] ?? buildSets(currentPE?.exercise_id)) }))
  }

  const updateSet = (index: number, field: 'weight' | 'reps', delta: number) => {
    updateSetsMap(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: Math.max(0, next[index][field] + delta) }
      return next
    })
  }

  const updateSupersetValue = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', delta: number) => {
    setSupersetMap(prev => {
      const prevMatrix = prev[step] ?? buildSupersetMatrix(currentPE)
      const prevSets = prevMatrix[exerciseId] || []
      const newSets = [...prevSets]
      newSets[setIndex] = { ...newSets[setIndex], [field]: Math.max(0, newSets[setIndex][field] + delta) }
      return { ...prev, [step]: { ...prevMatrix, [exerciseId]: newSets } }
    })
  }

  const addSet = () => {
    updateSetsMap(prev => {
      const last = prev[prev.length - 1] || { weight: 0, reps: 8 }
      return [...prev, { ...last }]
    })
  }

  const removeSet = (i: number) => {
    updateSetsMap(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Navigation ───────────────────────────────────────────

  const navigateTo = (target: number) => {
    const targetPE = programExercises[target]
    const targetIsSuperset = !!targetPE?.superset_template_id

    if (targetIsSuperset) {
      setSupersetMap(prev => ({
        ...prev,
        [target]: prev[target] ?? buildSupersetMatrix(targetPE),
      }))
    } else {
      setSetsMap(prev => ({
        ...prev,
        [target]: prev[target] ?? buildSets(targetPE?.exercise_id),
      }))
    }
    setStep(target)
  }

  // ── Logging ──────────────────────────────────────────────

  const logCurrent = async (then: 'next' | 'finish') => {
    setIsSubmitting(true)

    if (isSuperset) {
      await saveSupersetLog(workoutId, currentMatrix)
    } else if (currentPE.exercise_id) {
      await saveStrengthExercise(workoutId, currentPE.exercise_id, currentSets)
    }

    setLogged(prev => new Set(prev).add(step))

    if (then === 'finish') {
      await advanceRotation(program.id, nextRotationIndex)
      onComplete()
    } else {
      navigateTo(step + 1)
    }
    setIsSubmitting(false)
  }

  const skipCurrent = () => {
    setSkipped(prev => new Set(prev).add(step))
    if (isLast) {
      advanceRotation(program.id, nextRotationIndex).then(onComplete)
    } else {
      navigateTo(step + 1)
    }
  }

  // ── No exercises guard ───────────────────────────────────

  if (programExercises.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center space-y-4">
        <p className="text-gray-500 font-medium">This workout day has no exercises. Add some in Programs first.</p>
        <button onClick={onComplete} className="bg-black text-white font-bold rounded-xl py-3 px-6">Back</button>
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
            <span>{logged.size} logged</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${(logged.size / programExercises.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* Exercise name / superset header */}
        <div className="flex items-start justify-between">
          <div>
            {isSuperset ? (
              <>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">🔄 Superset</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{currentPE.superset_templates?.name || 'Superset'}</h3>
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Now lifting</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{currentExercise?.name || 'Unknown Exercise'}</h3>
              </>
            )}
          </div>
          {logged.has(step) && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-1 rounded-full mt-1">
              Logged ✓
            </span>
          )}
          {skipped.has(step) && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-400 px-2 py-1 rounded-full mt-1">
              Skipped
            </span>
          )}
        </div>

        {/* ── Single exercise sets ── */}
        {!isSuperset && (
          <>
            {currentExercise?.lastSession && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 -mt-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last</span>
                {currentExercise.lastSession.sets.map((s, i) => (
                  <span key={i} className="text-xs font-semibold text-gray-500">{s.weight}kg × {s.reps}</span>
                ))}
                <span className="text-[10px] text-gray-300 ml-auto">
                  {new Date(currentExercise.lastSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
            <div className="space-y-2">
              {currentSets.map((set, i) => (
                <div key={i} className="flex items-center justify-between gap-1 bg-gray-50 p-2 rounded-xl border border-gray-100 relative group">
                  {currentSets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSet(i)}
                      className="absolute -left-2 -top-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm"
                    >✕</button>
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
          </>
        )}

        {/* ── Superset matrix ── */}
        {isSuperset && (
          <div className="space-y-3">
            {/* How many sets does the first exercise have? */}
            {(() => {
              const firstExId = supersetExercises[0]?.exercise_id
              const numSets = (currentMatrix[firstExId] || []).length || 3
              return Array.from({ length: numSets }).map((_, setIndex) => (
                <div key={setIndex} className="bg-gray-900 rounded-2xl p-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Set {setIndex + 1}</h4>
                  {supersetExercises.map((te, exIdx) => {
                    const ex = exercises.find(e => e.id === te.exercise_id)
                    const exIncrement = ex?.increment_step || ex?.settings?.increment_step || 2.5
                    const rowData = currentMatrix[te.exercise_id]?.[setIndex] || { weight: 0, reps: 0 }
                    const lastMax = ex?.lastSession ? Math.max(...ex.lastSession.sets.map(s => s.weight)) : null
                    return (
                      <div key={te.exercise_id} className="flex items-center justify-between gap-2 bg-gray-800 p-2 rounded-xl border border-gray-700">
                        <div className="w-1/3 pr-2 min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            <span className="text-gray-500 mr-1">{String.fromCharCode(65 + exIdx)}</span>
                            {te.exercises?.name || 'Exercise'}
                          </div>
                          {lastMax !== null && (
                            <div className="text-[9px] text-gray-500 font-semibold mt-0.5 truncate">
                              Last: {lastMax}kg
                            </div>
                          )}
                        </div>

                        <div className="flex items-center bg-gray-700 rounded-lg border border-gray-600 flex-1">
                          <button type="button" onClick={() => updateSupersetValue(te.exercise_id, setIndex, 'weight', -exIncrement)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-600 rounded-l-lg">-</button>
                          <div className="flex-1 text-center leading-tight">
                            <div className="font-bold text-white text-sm">{Number(rowData.weight.toFixed(2))}</div>
                            <div className="text-[9px] text-gray-500 font-semibold uppercase">kg</div>
                          </div>
                          <button type="button" onClick={() => updateSupersetValue(te.exercise_id, setIndex, 'weight', exIncrement)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-600 rounded-r-lg">+</button>
                        </div>

                        <div className="flex items-center bg-gray-700 rounded-lg border border-gray-600 flex-1">
                          <button type="button" onClick={() => updateSupersetValue(te.exercise_id, setIndex, 'reps', -1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-600 rounded-l-lg">-</button>
                          <div className="flex-1 text-center leading-tight">
                            <div className="font-bold text-white text-sm">{rowData.reps}</div>
                            <div className="text-[9px] text-gray-500 font-semibold uppercase">reps</div>
                          </div>
                          <button type="button" onClick={() => updateSupersetValue(te.exercise_id, setIndex, 'reps', 1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-600 rounded-r-lg">+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            })()}
          </div>
        )}

        {/* Back / Log+Next row */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigateTo(step - 1)}
            disabled={isFirst || isSubmitting}
            className="w-12 h-14 flex-shrink-0 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-30 text-lg"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => logCurrent(isLast ? 'finish' : 'next')}
            disabled={isSubmitting}
            className="flex-1 bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting
              ? 'Saving...'
              : logged.has(step)
              ? isLast ? 'Re-log & Finish' : 'Re-log & Next →'
              : isLast ? 'Log & Finish' : 'Log & Next →'}
          </button>

          <button
            type="button"
            onClick={() => navigateTo(step + 1)}
            disabled={isLast || isSubmitting}
            className="w-12 h-14 flex-shrink-0 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-30 text-lg"
          >
            →
          </button>
        </div>

        {/* Skip */}
        <button
          type="button"
          onClick={skipCurrent}
          disabled={isSubmitting || logged.has(step)}
          className="w-full text-sm text-gray-400 hover:text-gray-700 font-semibold py-1 transition-colors disabled:opacity-30"
        >
          {logged.has(step) ? 'Already logged' : 'Skip this exercise'}
        </button>
      </div>

      {/* Tappable exercise queue */}
      {programExercises.length > 1 && (
        <div className="border-t border-gray-100 px-5 py-3 flex gap-2 overflow-x-auto">
          {programExercises.map((pe, i) => {
            const isLogged = logged.has(i)
            const isSkipped = skipped.has(i)
            const isCurrent = i === step
            const label = pe.superset_template_id
              ? pe.superset_templates?.name || 'Superset'
              : exercises.find(e => e.id === pe.exercise_id)?.name || 'Exercise'

            return (
              <button
                key={pe.id}
                type="button"
                onClick={() => navigateTo(i)}
                className={`flex-shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-black text-white'
                    : isLogged
                    ? 'bg-green-100 text-green-700'
                    : isSkipped
                    ? 'bg-gray-100 text-gray-400 line-through'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {pe.superset_template_id && <span className="mr-1">🔄</span>}
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
