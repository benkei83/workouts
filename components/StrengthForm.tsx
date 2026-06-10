'use client'

// In-memory store + sessionStorage backup — see InteractiveCanvas for rationale.
type StrengthDraft = { selectedExercise: string; sets: { weight: number; reps: number; rpe?: number | null }[] }
const _draftStore: Record<string, StrengthDraft> = {}
const SS_DRAFT_KEY = (id: string) => `wkt-${id}-strength-draft`

function readDraft(workoutId: string, exercises: { id: string }[]): StrengthDraft | null {
  const mem = _draftStore[workoutId]
  if (mem?.selectedExercise && mem.sets?.length && exercises.find(e => e.id === mem.selectedExercise)) {
    return mem
  }
  try {
    const raw = sessionStorage.getItem(SS_DRAFT_KEY(workoutId))
    if (raw) {
      const d: StrengthDraft = JSON.parse(raw)
      if (d?.selectedExercise && d.sets?.length && exercises.find(e => e.id === d.selectedExercise)) {
        return d
      }
    }
  } catch {}
  return null
}

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { saveStrengthExercise, deleteStrengthLog, createCustomExercise, updateExerciseSettings } from '@/app/workout/actions'
import ExerciseSettingsFields from '@/components/ExerciseSettingsFields'
import DeloadBadge from '@/components/DeloadBadge'
import SuccessBadge from '@/components/SuccessBadge'
import MaintenanceBadge from '@/components/MaintenanceBadge'
import WgerBrowseModal, { type WgerItem } from '@/components/WgerBrowseModal'
import { getDeloadStatus, getSuccessStatus, getMaintenanceStatus } from '@/lib/deload'
import type { ComputedStreak } from '@/lib/streaks'
import RestTimer from '@/components/RestTimer'
import type { UserSettings } from '@/lib/settings'
import { DEFAULT_USER_SETTINGS } from '@/lib/settings'

type SetData = { weight: number; reps: number; rpe?: number | null }
type LastSession = { date: string; sets: { weight: number; reps: number }[] }
type Exercise = {
  id: string
  name: string
  increment_step?: number
  settings?: any
  lastSession?: LastSession | null
  computedStreak?: ComputedStreak
}

export default function StrengthForm({
  workoutId,
  exercises,
  onCancel,
  onSave,
  initialSets = 5,
  initialReps = 5,
  initialWeight = 60,
  editData,
  userSettings = DEFAULT_USER_SETTINGS,
  initialExerciseId,
}: {
  workoutId: string,
  exercises: Exercise[],
  onCancel: () => void,
  /** When provided (new-exercise flow), the canvas owns the server call — form just hands off data and closes. */
  onSave?: (exerciseId: string, exerciseName: string, sets: SetData[], skipProgression: boolean, notes?: string | null) => void,
  initialSets?: number,
  initialReps?: number,
  initialWeight?: number,
  editData?: any,
  userSettings?: UserSettings,
  /** When set (focus mode), pre-selects this exercise. */
  initialExerciseId?: string,
}) {
  // Local augmentable copy of exercises — so wger-added ones appear immediately
  const [exerciseList, setExerciseList] = useState(exercises)

  // ── Draft restoration ─────────────────────────────────────────────────────
  // Read synchronously (memory → sessionStorage) so useState initialisers can use
  // the value directly — no useEffect timing races possible.
  const draft = !editData ? readDraft(workoutId, exercises) : undefined

  const [selectedExercise, setSelectedExercise] = useState(() => {
    if (editData?.exerciseId) return editData.exerciseId
    // Focus mode: always start with the specified exercise
    if (initialExerciseId && exercises.find(e => e.id === initialExerciseId)) {
      return initialExerciseId
    }
    if (draft?.selectedExercise && exercises.find(e => e.id === draft.selectedExercise)) {
      return draft.selectedExercise
    }
    return exercises[0]?.id || ''
  })

  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uiMode, setUiMode] = useState<'select' | 'create' | 'edit_settings'>('select')
  const [isWgerOpen, setIsWgerOpen] = useState(false)
  const [skipProgression, setSkipProgression] = useState(false)
  const [note, setNote] = useState<string>(editData?.notes ?? '')

  // ── Set-completion checkboxes + rest timer ───────────────
  const [checkedSets, setCheckedSets] = useState<Set<number>>(new Set())
  const [restStartTime, setRestStartTime] = useState<number | null>(null)

  const toggleSetChecked = (index: number) => {
    setCheckedSets(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
        setRestStartTime(null)
      } else {
        next.add(index)
        setRestStartTime(Date.now())
      }
      return next
    })
  }

  const libraryNames = new Set(exerciseList.map(e => e.name.toLowerCase()))

  // Initialize state from existing data, a restored draft, or exercise defaults
  const [sets, setSets] = useState<SetData[]>(() => {
    if (editData?.rawSets) {
      // Preserve RPE values when editing an existing log
      return editData.rawSets.map((s: any) => ({
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe ?? null,
      }))
    }

    // Restore sets from draft (selectedExercise is already resolved above)
    if (draft?.sets && draft.sets.length > 0) return draft.sets

    const defaultEx  = exercises.find(ex => ex.id === selectedExercise)
    const tSets      = defaultEx?.settings?.target_sets    || initialSets
    const tReps      = defaultEx?.settings?.target_reps    || initialReps
    const tRepsMin   = defaultEx?.settings?.target_reps_min || tReps
    const tWeight    = defaultEx?.settings?.current_weight ?? initialWeight
    const isAmrapEx  = defaultEx?.settings?.protocol === 'amrap'

    if (isAmrapEx && tSets > 1) {
      // First N-1 sets: fixed reps; last set: AMRAP (pre-fill with 0 so user enters their actual count)
      return [
        ...Array.from({ length: tSets - 1 }, () => ({ weight: tWeight, reps: tRepsMin, rpe: null })),
        { weight: tWeight, reps: 0, rpe: null },
      ]
    }

    return Array.from({ length: tSets }, () => ({
      weight: tWeight,
      reps: tReps,
      rpe: null,
    }))
  })

  // When a draft was restored, suppress pre-fill until the user explicitly picks a
  // different exercise. The flag is cleared in changeExercise() — NOT inside the
  // effect — so Strict Mode's double-invocation can't accidentally flip it.
  const suppressPreFillRef = useRef(!!(draft?.sets?.length && !editData))

  // Wrapper used everywhere we set selectedExercise: clears the draft-guard so
  // pre-fill runs normally after the user has made a deliberate exercise choice.
  const changeExercise = (id: string) => {
    suppressPreFillRef.current = false
    setSelectedExercise(id)
  }

  const activeExerciseData = exerciseList.find(ex => ex.id === selectedExercise)
  const currentIncrement = activeExerciseData?.increment_step || 2.5

  // SMART PRE-FILL: Auto-update the UI when the user selects a different exercise
  useEffect(() => {
    if (!editData && activeExerciseData) {
      if (suppressPreFillRef.current) return  // restored draft — keep its sets
      const tSets    = activeExerciseData.settings?.target_sets     || initialSets
      const tReps    = activeExerciseData.settings?.target_reps     || initialReps
      const tRepsMin = activeExerciseData.settings?.target_reps_min || tReps
      const tWeight  = activeExerciseData.settings?.current_weight  ?? initialWeight
      const isAmrapEx = activeExerciseData.settings?.protocol === 'amrap'

      if (isAmrapEx && tSets > 1) {
        setSets([
          ...Array.from({ length: tSets - 1 }, () => ({ weight: tWeight, reps: tRepsMin, rpe: null })),
          { weight: tWeight, reps: 0, rpe: null },
        ])
      } else {
        setSets(Array.from({ length: tSets }, () => ({ weight: tWeight, reps: tReps, rpe: null })))
      }
    }
  }, [selectedExercise, activeExerciseData, editData, initialSets, initialReps, initialWeight])

  // Keep both stores up to date synchronously after every commit (useLayoutEffect runs
  // before paint, so the store is always current before the user can trigger navigation)
  useLayoutEffect(() => {
    if (editData) return
    const d: StrengthDraft = { selectedExercise, sets }
    _draftStore[workoutId] = d
    try { sessionStorage.setItem(SS_DRAFT_KEY(workoutId), JSON.stringify(d)) } catch {}
  }, [selectedExercise, sets, workoutId, editData])

  const handleInlineCreate = async () => {
    const input = document.getElementById('new-exercise-input') as HTMLInputElement
    const name = input?.value.trim()
    if (!name) return

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('name', name)
    formData.append('category', 'strength')

    const res = await createCustomExercise(formData)
    
    if (res?.success && res.id) {
      changeExercise(res.id)
      setUiMode('select')
    }
    setIsSubmitting(false)
  }

  const handleInlineSettingsSave = async (formData: FormData) => {
    setIsSubmitting(true)
    const newWeight   = parseFloat(formData.get('weight') as string)
    const newSets     = parseInt(formData.get('sets') as string)     || 5
    const newReps     = parseInt(formData.get('reps') as string)     || 5
    const newRepsMin  = parseInt(formData.get('reps_min') as string) || 8
    const newProtocol = formData.get('protocol') as string
    const newIncrement= parseFloat(formData.get('increment') as string) || 2.5

    await updateExerciseSettings(selectedExercise, {
      sets:             newSets,
      reps:             newReps,
      reps_min:         newRepsMin,
      weight:           isNaN(newWeight) ? 0 : newWeight,
      increment:        newIncrement,
      progression_rate: parseFloat(formData.get('progression_rate') as string) || 2.5,
      protocol:         newProtocol,
      min_successes:    parseInt(formData.get('min_successes') as string)    || 1,
      max_failures:     parseInt(formData.get('max_failures') as string)     || 3,
      deload_multiplier:parseFloat(formData.get('deload_multiplier') as string) || 2.0,
      current_failures: activeExerciseData?.settings?.current_failures  || 0,
      current_successes:activeExerciseData?.settings?.current_successes || 0,
    })

    // Update local exerciseList so pre-fill reflects new settings immediately
    const updatedSettings = {
      ...(activeExerciseData?.settings ?? {}),
      target_sets:      newSets,
      target_reps:      newReps,
      target_reps_min:  newRepsMin,
      current_weight:   isNaN(newWeight) ? 0 : newWeight,
      increment_step:   newIncrement,
      protocol:         newProtocol,
    }
    setExerciseList(prev => prev.map(ex =>
      ex.id === selectedExercise ? { ...ex, settings: updatedSettings } : ex
    ))

    // Re-trigger pre-fill with the new values
    const isAmrapEx = newProtocol === 'amrap'
    const tWeight   = isNaN(newWeight) ? 0 : newWeight
    if (isAmrapEx && newSets > 1) {
      setSets([
        ...Array.from({ length: newSets - 1 }, () => ({ weight: tWeight, reps: newRepsMin, rpe: null })),
        { weight: tWeight, reps: 0, rpe: null },
      ])
    } else {
      setSets(Array.from({ length: newSets }, () => ({ weight: tWeight, reps: newReps, rpe: null })))
    }

    setIsSubmitting(false)
    setUiMode('select')
  }

  // Deep-copy to avoid React 18 strict mode double-firing
  const updateSet = (index: number, field: 'weight' | 'reps', delta: number) => {
    setSets(prev => {
      const newSets = [...prev]
      newSets[index] = {
        ...newSets[index],
        [field]: Math.max(0, newSets[index][field] + delta),
      }
      return newSets
    })
  }

  const updateRpe = (index: number, raw: string) => {
    const val = raw === '' ? null : parseFloat(raw)
    setSets(prev => {
      const next = [...prev]
      next[index] = { ...next[index], rpe: val != null && isNaN(val) ? null : val }
      return next
    })
  }

  const addSet = () => {
    const lastSet = sets[sets.length - 1] || { weight: initialWeight, reps: initialReps }
    // New sets start with no RPE — the user can optionally add it after completing the set
    setSets([...sets, { weight: lastSet.weight, reps: lastSet.reps, rpe: null }])
  }

  const removeSet = (indexToRemove: number) => {
    setSets(sets.filter((_, index) => index !== indexToRemove))
  }

  const clearDraft = () => {
    delete _draftStore[workoutId]
    try { sessionStorage.removeItem(SS_DRAFT_KEY(workoutId)) } catch {}
  }

  const handleSave = async () => {
    clearDraft()
    // ── Optimistic path (new exercise, canvas owns the server call) ──
    if (onSave && !editData) {
      const exerciseName = exercises.find(e => e.id === selectedExercise)?.name || 'Exercise'
      onSave(selectedExercise, exerciseName, sets, skipProgression, note.trim() || null)
      onCancel()
      return
    }

    // ── Standard path (edit flow) ──
    setIsSubmitting(true)
    if (editData) await deleteStrengthLog(editData.logId, workoutId)
    const result = await saveStrengthExercise(workoutId, selectedExercise, sets, {
      createdAt:       editData?.createdAt,
      supersetId:      editData?.supersetId,
      skipProgression,
      notes:           note.trim() || null,
    })
    setIsSubmitting(false)
    if (result?.error) alert(`Database Error: ${result.error}`)
    else { router.refresh(); onCancel() }
  }

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">🏋️ {editData ? 'Edit' : 'Log'} Lifts</h2>
        <button type="button" onClick={() => { clearDraft(); onCancel() }} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exercise</label>
        
        {uiMode === 'select' && (
          <div className="space-y-2">
            {/* Exercise selector + settings */}
            <div className="flex gap-2">
              <select
                value={selectedExercise}
                onChange={(e) => changeExercise(e.target.value)}
                className="flex-1 min-w-0 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:ring-2 focus:ring-black appearance-none truncate"
              >
                {exerciseList.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setUiMode('edit_settings')}
                className="flex-shrink-0 bg-gray-100 text-gray-500 font-bold px-3 rounded-xl hover:bg-gray-200 transition-colors"
              >⚙️</button>
            </div>
            {/* Add exercise buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUiMode('create')}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >+ Custom</button>
              <button
                type="button"
                onClick={() => setIsWgerOpen(true)}
                className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm"
              >Browse wger</button>
            </div>
          </div>
        )}

        {uiMode === 'create' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                id="new-exercise-input" type="text" placeholder="e.g., T-Bar Row"
                className="flex-1 min-w-0 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:ring-2 focus:ring-black" autoFocus
              />
              <button type="button" onClick={handleInlineCreate} disabled={isSubmitting} className="flex-shrink-0 bg-black text-white font-bold px-4 rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setUiMode('select')} className="flex-shrink-0 bg-gray-100 text-gray-500 font-bold px-3 rounded-xl hover:bg-gray-200 transition-colors">✕</button>
            </div>
          </div>
        )}

        {uiMode === 'edit_settings' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-sm text-gray-900">Edit Settings: {activeExerciseData?.name}</h4>
              <button type="button" onClick={() => setUiMode('select')} className="text-gray-400 font-bold text-sm">Cancel</button>
            </div>
            <form action={handleInlineSettingsSave}>
              <ExerciseSettingsFields settings={activeExerciseData?.settings} exerciseId={selectedExercise ?? undefined} exerciseName={activeExerciseData?.name} />
              <button type="submit" disabled={isSubmitting} className="col-span-2 w-full bg-black text-white font-bold rounded-lg py-3 mt-4 active:scale-95 transition-all">
                {isSubmitting ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        )}

        {/* Streak badges (log-computed) */}
        {uiMode === 'select' && (() => {
          const streak = activeExerciseData?.computedStreak
          const settings = activeExerciseData?.settings
          const ss = getSuccessStatus(settings, streak)
          const ms = getMaintenanceStatus(settings, streak)
          const ds = getDeloadStatus(settings, streak)
          return (
            <>
              {ss && <SuccessBadge status={ss} />}
              {ms && <MaintenanceBadge status={ms} />}
              {ds && <DeloadBadge status={ds} />}
            </>
          )
        })()}

        {/* Progression state — shown when exercise has auto-progression */}
        {uiMode === 'select' && activeExerciseData?.settings?.protocol && activeExerciseData.settings.protocol !== 'manual' && (() => {
          const s = activeExerciseData.settings!
          const successes   = Number(s.current_successes) || 0
          const minSucc     = Number(s.min_successes)     || 1
          const failures    = Number(s.current_failures)  || 0
          const maxFail     = Number(s.max_failures)       || 3
          const progRate    = Number(s.progression_rate)  || 2.5
          const nextWeight  = (Number(s.current_weight) || 0) + progRate
          const deloadWeight = Math.max(0, (Number(s.current_weight) || 0) - progRate * (Number(s.deload_multiplier) || 2))

          // Only show the inline block for failure warnings — the deload target weight
          // is useful info not shown by DeloadBadge. Success/maintenance are handled
          // by SuccessBadge and MaintenanceBadge above to avoid duplicates.
          if (failures > 0) {
            return (
              <div className="flex items-center gap-2 px-4 py-2 mb-2 rounded-xl bg-red-50 border border-red-100">
                <span className="text-red-400 text-sm">⚠</span>
                <p className="text-xs font-semibold text-red-600">
                  {failures}/{maxFail} failures — deload to {deloadWeight}kg if missed again
                </p>
              </div>
            )
          }
          return null
        })()}

        {/* Last session reference */}
        {uiMode === 'select' && !editData && activeExerciseData?.lastSession && (
          <div className="mt-2 px-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last</span>
            {activeExerciseData.lastSession.sets.map((s, i) => (
              <span key={i} className="text-xs font-semibold text-gray-500">{s.weight}kg × {s.reps}</span>
            ))}
            <span className="text-[10px] text-gray-300 ml-auto">
              {new Date(activeExerciseData.lastSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      {/* Per-exercise note */}
      {uiMode === 'select' && (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Exercise notes… (cues, feelings, plan for next time)"
          rows={note ? 3 : 1}
          maxLength={500}
          className="w-full mb-4 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-900 resize-none transition-all"
        />
      )}

      {/* Rest timer */}
      <RestTimer
        startedAt={restStartTime}
        defaultSecs={userSettings.rest_timer_default_secs}
        vibrateOnComplete={userSettings.vibrate_on_rest_complete}
        soundOnComplete={userSettings.sound_on_rest_complete}
      />

      <div className="space-y-2 mb-6">
        {sets.map((set, index) => {
          const isChecked = checkedSets.has(index)
          const isCheated = set.rpe != null && set.rpe > 10
          const showRpe   = isChecked || (set.rpe != null)
          const isAmrapSet = activeExerciseData?.settings?.protocol === 'amrap'
            && index === sets.length - 1
          return (
            <div key={index} className="space-y-1">
              {/* AMRAP label above the last set */}
              {isAmrapSet && (
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">AMRAP</span>
                  <span className="text-[10px] text-gray-400">— go to your max</span>
                </div>
              )}
              {/* ── Main set row ── */}
              <div className={`flex items-center justify-between gap-1 p-2 rounded-xl border relative group transition-colors ${
                isAmrapSet ? (isChecked ? 'bg-purple-50 border-purple-200' : 'bg-purple-50/50 border-purple-100') :
                isCheated  ? 'bg-red-50 border-red-100'   :
                isChecked  ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'
              }`}>
                {sets.length > 1 && (
                  <button type="button" onClick={() => removeSet(index)} className="absolute -left-2 -top-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm">✕</button>
                )}
                <div className={`font-bold w-4 text-center text-sm transition-colors ${
                  isCheated ? 'text-red-300' : isChecked ? 'text-green-400' : 'text-gray-400'
                }`}>{index + 1}</div>

                <div className="flex items-center bg-white rounded-lg border border-gray-200">
                  <button type="button" onClick={() => updateSet(index, 'weight', -currentIncrement)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
                  <div className="text-center w-12 leading-tight">
                    <div className="font-bold text-gray-900">{Number(set.weight.toFixed(2))}</div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase">kg</div>
                  </div>
                  <button type="button" onClick={() => updateSet(index, 'weight', currentIncrement)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
                </div>

                <div className="text-gray-300 font-bold text-sm px-1">×</div>

                <div className="flex items-center bg-white rounded-lg border border-gray-200">
                  <button type="button" onClick={() => updateSet(index, 'reps', -1)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
                  <div className="text-center w-10 leading-tight">
                    <div className="font-bold text-gray-900">{set.reps}</div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase">reps</div>
                  </div>
                  <button type="button" onClick={() => updateSet(index, 'reps', 1)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
                </div>

                <button
                  type="button"
                  onClick={() => toggleSetChecked(index)}
                  className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2 font-bold text-sm transition-all active:scale-95 ${
                    isChecked ? 'bg-green-500 border-green-500 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-200'
                  }`}
                >✓</button>
              </div>

              {/* ── RPE row — appears after set is checked or if already has a value ── */}
              {showRpe && (
                <div className="flex items-center gap-2 pl-7 pr-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-7">RPE</span>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="0.5"
                    placeholder="—"
                    value={set.rpe ?? ''}
                    onChange={e => updateRpe(index, e.target.value)}
                    className={`w-16 text-center text-sm font-bold rounded-lg border py-1.5 outline-none focus:ring-1 transition-colors ${
                      isCheated
                        ? 'border-red-200 bg-red-50 text-red-500 focus:ring-red-300'
                        : 'border-gray-200 bg-white text-gray-700 focus:ring-gray-300 placeholder:text-gray-300'
                    }`}
                  />
                  {isCheated ? (
                    <span className="text-[10px] text-red-500 font-semibold">⚠ Won't count toward records or progression</span>
                  ) : set.rpe != null ? (
                    <span className="text-[10px] text-gray-400">
                      {set.rpe >= 10 ? 'Max effort' : set.rpe >= 8 ? '1-2 reps left' : set.rpe >= 6 ? '3-4 reps left' : 'Moderate'}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button type="button" onClick={addSet} className="w-full border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-xl py-3 mb-4 hover:border-black transition-colors">
        + Add Set
      </button>

      {/* Skip progression toggle — only shown when the exercise has an active auto-progression protocol */}
      {activeExerciseData?.settings?.protocol && activeExerciseData.settings.protocol !== 'manual' && (
        <button
          type="button"
          onClick={() => setSkipProgression(p => !p)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 mb-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-700">Skip progression</p>
            <p className="text-xs text-gray-400">Log this session without updating weight targets</p>
          </div>
          <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${skipProgression ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${skipProgression ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </button>
      )}

      <button type="button" onClick={handleSave} disabled={isSubmitting || uiMode !== 'select'} className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50">
        {isSubmitting ? 'Saving...' : (editData ? 'Update Exercise' : 'Save Exercise')}
      </button>

      {/* wger browse — adds to library AND selects the exercise */}
      {isWgerOpen && (
        <WgerBrowseModal
          libraryNames={libraryNames}
          onClose={() => setIsWgerOpen(false)}
          onAdded={(item: WgerItem, id: string) => {
            // Add to local list so it appears in the dropdown immediately
            setExerciseList(prev => [...prev, { id, name: item.name, increment_step: 2.5, settings: null }])
            changeExercise(id)
            setIsWgerOpen(false)
          }}
        />
      )}
    </div>
  )
}