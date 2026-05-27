'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { saveSupersetLog, saveSupersetTemplate, updateSupersetLog, deleteSupersetTemplate, renameSupersetTemplate, updateExerciseSettings } from '@/app/workout/actions'
import ExerciseSettingsFields from '@/components/ExerciseSettingsFields'
import DeloadBadge from '@/components/DeloadBadge'
import SuccessBadge from '@/components/SuccessBadge'
import MaintenanceBadge from '@/components/MaintenanceBadge'
import { getDeloadStatus, getSuccessStatus, getMaintenanceStatus } from '@/lib/deload'
import type { ComputedStreak } from '@/lib/streaks'
import RestTimer from '@/components/RestTimer'
import type { UserSettings } from '@/lib/settings'
import { DEFAULT_USER_SETTINGS } from '@/lib/settings'

type LastSession = { date: string; sets: { weight: number; reps: number }[] }
type Exercise = {
  id: string
  name: string
  increment_step?: number
  settings?: any
  lastSession?: LastSession | null
  computedStreak?: ComputedStreak
}

type SupersetTemplate = {
  id: string
  name: string
  superset_template_exercises: {
    sort_order: number
    exercise_id: string
    exercises: { id: string; name: string }
  }[]
}

// Passed when editing an existing superset
type EditCard = {
  logId: string
  exerciseId: string
  name: string
  rawSets: { weight: number; reps: number }[]
}

type SetMatrix = { [exerciseId: string]: { weight: number, reps: number }[] }

export default function SupersetForm({
  workoutId,
  exercises,
  supersetTemplates = [],
  editData,
  onCancel,
  onSave,
  userSettings = DEFAULT_USER_SETTINGS,
}: {
  workoutId: string
  exercises: Exercise[]
  supersetTemplates?: SupersetTemplate[]
  editData?: EditCard[]   // provided when editing an existing superset
  onCancel: () => void
  /** When provided (new superset flow), the canvas owns the server call. */
  onSave?: (matrix: Record<string, { weight: number; reps: number }[]>, names: Record<string, string>) => void
  userSettings?: UserSettings
}) {
  const router = useRouter()
  const isEditing = !!editData && editData.length > 0

  // In edit mode we jump straight to 'logging'; the exercises are locked
  const [mode, setMode] = useState<'setup' | 'logging'>(isEditing ? 'logging' : 'setup')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── SETUP STATE (new superset only) ──────────────────────
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>(
    isEditing ? editData!.map(c => c.exerciseId) : ['', '']
  )
  const [targetSets, setTargetSets] = useState(
    isEditing ? (editData![0]?.rawSets.length || 3) : 3
  )

  // ── MATRIX STATE ─────────────────────────────────────────
  const buildInitialMatrix = (): SetMatrix => {
    if (isEditing) {
      const m: SetMatrix = {}
      editData!.forEach(card => { m[card.exerciseId] = card.rawSets.map(s => ({ ...s })) })
      return m
    }
    return {}
  }
  const [matrix, setMatrix] = useState<SetMatrix>(buildInitialMatrix)

  // ── TEMPLATE SAVE STATE (new only) ───────────────────────
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

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

  // ── TEMPLATE MANAGE STATE ─────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [settingsOpenFor, setSettingsOpenFor] = useState<string | null>(null)
  const [settingsOpenForSetIndex, setSettingsOpenForSetIndex] = useState<number | null>(null)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // ── SETUP HANDLERS ────────────────────────────────────────
  const updateSelectedExercise = (index: number, value: string) => {
    const next = [...selectedExerciseIds]
    next[index] = value
    setSelectedExerciseIds(next)
  }
  const addExerciseSlot = () => setSelectedExerciseIds([...selectedExerciseIds, ''])
  const removeExerciseSlot = (index: number) =>
    setSelectedExerciseIds(selectedExerciseIds.filter((_, i) => i !== index))

  const loadFromTemplate = (templateId: string) => {
    const template = supersetTemplates.find(t => t.id === templateId)
    if (!template) return
    const sorted = [...template.superset_template_exercises].sort((a, b) => a.sort_order - b.sort_order)
    setSelectedExerciseIds(sorted.map(te => te.exercise_id))
  }

  const generateMatrix = () => {
    const validIds = selectedExerciseIds.filter(id => id !== '')
    if (validIds.length < 2) { alert('Please select at least two exercises.'); return }
    const m: SetMatrix = {}
    validIds.forEach(id => {
      const ex = exercises.find(e => e.id === id)
      m[id] = Array.from({ length: targetSets }, () => ({
        weight: ex?.settings?.current_weight ?? 0,
        reps: ex?.settings?.target_reps ?? 0,
      }))
    })
    setMatrix(m)
    setMode('logging')
  }

  // ── MATRIX HANDLERS ───────────────────────────────────────
  const updateMatrixValue = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', delta: number) => {
    setMatrix(prev => {
      const updated = { ...prev, [exerciseId]: [...prev[exerciseId]] }
      updated[exerciseId][setIndex] = {
        ...updated[exerciseId][setIndex],
        [field]: Math.max(0, updated[exerciseId][setIndex][field] + delta),
      }
      return updated
    })
  }

  // ── SAVE ──────────────────────────────────────────────────
  const handleSave = async () => {
    // ── Optimistic path (new superset, canvas owns the server call) ──
    if (onSave && !isEditing) {
      const names: Record<string, string> = {}
      activeIds.forEach(id => { names[id] = getExerciseName(id) })
      onSave(matrix, names)
      onCancel()
      return
    }

    setIsSubmitting(true)

    if (isEditing) {
      const payload = editData!.map(card => ({
        logId: card.logId,
        exerciseId: card.exerciseId,
        sets: matrix[card.exerciseId] || [],
      }))
      const result = await updateSupersetLog(payload, workoutId)
      setIsSubmitting(false)
      if (result && 'error' in result) {
        alert(`Error: ${result.error}`)
      } else {
        router.refresh()
        onCancel()
      }
    } else {
      // Fallback (no onSave prop — shouldn't happen in normal flow)
      const result = await saveSupersetLog(workoutId, matrix)
      setIsSubmitting(false)
      if (result && 'error' in result) {
        alert(`Error: ${result.error}`)
      } else {
        onCancel()
      }
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    const validIds = selectedExerciseIds.filter(id => id !== '')
    if (validIds.length < 2) { alert('Select at least two exercises first.'); return }
    setIsSavingTemplate(true)
    const result = await saveSupersetTemplate(templateName.trim(), validIds)
    setIsSavingTemplate(false)
    if (result && 'error' in result) {
      alert(`Error saving template: ${result.error}`)
    } else {
      setTemplateName('')
      setShowSaveTemplate(false)
    }
  }

  const handleRenameTemplate = async (id: string) => {
    if (!renameValue.trim()) return
    const result = await renameSupersetTemplate(id, renameValue.trim())
    if (result && 'error' in result) alert(`Error: ${result.error}`)
    else setRenamingId(null)
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Delete this template?')) return
    setIsDeletingId(id)
    const result = await deleteSupersetTemplate(id)
    setIsDeletingId(null)
    if (result && 'error' in result) alert(`Error: ${result.error}`)
  }

  const handleSettingsSave = async (exerciseId: string, formData: FormData) => {
    const ex = exercises.find(e => e.id === exerciseId)
    setIsSavingSettings(true)
    await updateExerciseSettings(exerciseId, {
      sets: parseInt(formData.get('sets') as string) || 3,
      reps: parseInt(formData.get('reps') as string) || 8,
      reps_min: parseInt(formData.get('reps_min') as string) || 8,
      weight: parseFloat(formData.get('weight') as string) || 0,
      increment: parseFloat(formData.get('increment') as string) || 2.5,
      progression_rate: parseFloat(formData.get('progression_rate') as string) || 2.5,
      protocol: formData.get('protocol') as string,
      min_successes: parseInt(formData.get('min_successes') as string) || 1,
      max_failures: parseInt(formData.get('max_failures') as string) || 3,
      deload_multiplier: parseFloat(formData.get('deload_multiplier') as string) || 2.0,
      current_failures: ex?.settings?.current_failures || 0,
      current_successes: ex?.settings?.current_successes || 0,
    })
    setIsSavingSettings(false)
    router.refresh()
    setSettingsOpenFor(null)
  }

  // ── RENDER ────────────────────────────────────────────────
  // Which exercises are active (for the matrix columns)
  const activeIds = isEditing
    ? editData!.map(c => c.exerciseId)
    : selectedExerciseIds.filter(id => id !== '')

  const getExerciseName = (id: string) => {
    if (isEditing) return editData!.find(c => c.exerciseId === id)?.name || 'Exercise'
    return exercises.find(e => e.id === id)?.name || 'Exercise'
  }

  const getIncrement = (id: string) => {
    const ex = exercises.find(e => e.id === id)
    return ex?.increment_step || ex?.settings?.increment_step || 2.5
  }

  const getLastSession = (id: string) => exercises.find(e => e.id === id)?.lastSession ?? null

  const numSets = matrix[activeIds[0]]?.length ?? targetSets

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {isEditing ? '✏️ Edit Superset' : '🔄 Log Superset'}
        </h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      {/* ── SETUP MODE (new superset only) ── */}
      {mode === 'setup' && (
        <div className="space-y-6">
          {supersetTemplates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Saved Templates</label>
              <div className="space-y-2">
                {supersetTemplates.map(t => (
                  <div key={t.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    {renamingId === t.id ? (
                      <>
                        <input
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameTemplate(t.id); if (e.key === 'Escape') setRenamingId(null) }}
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                          autoFocus
                        />
                        <button type="button" onClick={() => handleRenameTemplate(t.id)} className="text-xs font-bold text-white bg-black px-2 py-1 rounded-lg">Save</button>
                        <button type="button" onClick={() => setRenamingId(null)} className="text-gray-400 font-bold text-sm px-1">✕</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-bold text-gray-900 truncate">{t.name}</span>
                        <button type="button" onClick={() => loadFromTemplate(t.id)} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors flex-shrink-0">Load</button>
                        <button type="button" onClick={() => { setRenamingId(t.id); setRenameValue(t.name) }} className="text-gray-300 hover:text-gray-600 font-bold text-xs transition-colors">✏️</button>
                        <button type="button" onClick={() => handleDeleteTemplate(t.id)} disabled={isDeletingId === t.id} className="text-gray-300 hover:text-red-500 font-bold text-sm transition-colors disabled:opacity-40">✕</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Circuit Exercises</label>
            {selectedExerciseIds.map((exId, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center">
                  <span className="text-xs font-bold text-gray-400 mr-3">{String.fromCharCode(65 + index)}</span>
                  <select
                    value={exId}
                    onChange={e => updateSelectedExercise(index, e.target.value)}
                    className="bg-transparent font-bold text-gray-900 outline-none w-full truncate appearance-none"
                  >
                    <option value="" disabled>Select Exercise...</option>
                    {exercises.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                </div>
                {selectedExerciseIds.length > 2 && (
                  <button onClick={() => removeExerciseSlot(index)} className="bg-red-50 text-red-500 font-bold px-4 rounded-xl">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addExerciseSlot} className="text-sm font-bold text-blue-500 py-1">
              + Add Exercise to Circuit
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Sets</label>
            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 max-w-[150px]">
              <button type="button" onClick={() => setTargetSets(Math.max(1, targetSets - 1))} className="w-12 h-12 flex items-center justify-center font-bold text-gray-500 active:bg-gray-200 rounded-l-xl">-</button>
              <div className="flex-1 text-center font-bold text-xl text-gray-900">{targetSets}</div>
              <button type="button" onClick={() => setTargetSets(targetSets + 1)} className="w-12 h-12 flex items-center justify-center font-bold text-gray-500 active:bg-gray-200 rounded-r-xl">+</button>
            </div>
          </div>

          {!showSaveTemplate ? (
            <button type="button" onClick={() => setShowSaveTemplate(true)} className="text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors">
              💾 Save this circuit as a template
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate() }}
              />
              <button type="button" onClick={handleSaveTemplate} disabled={!templateName.trim() || isSavingTemplate} className="bg-black text-white font-bold px-4 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-all">
                {isSavingTemplate ? '...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowSaveTemplate(false)} className="text-gray-400 font-bold px-2">✕</button>
            </div>
          )}

          <button type="button" onClick={generateMatrix} className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all">
            Continue →
          </button>
        </div>
      )}

      {/* ── LOGGING / EDIT MODE ── */}
      {mode === 'logging' && (
        <div className="space-y-6">
          {/* Rest timer */}
          <RestTimer
            startedAt={restStartTime}
            defaultSecs={userSettings.rest_timer_default_secs}
            vibrateOnComplete={userSettings.vibrate_on_rest_complete}
          />

          {Array.from({ length: numSets }).map((_, setIndex) => {
            const isChecked = checkedSets.has(setIndex)
            return (
            <div key={setIndex} className={`rounded-2xl p-4 shadow-inner space-y-3 transition-colors ${isChecked ? 'bg-gray-800 ring-1 ring-green-500/30' : 'bg-gray-900'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isChecked ? 'text-green-400' : 'text-gray-400'}`}>Set {setIndex + 1}</h4>
                <button
                  type="button"
                  onClick={() => toggleSetChecked(setIndex)}
                  className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full border-2 font-bold text-xs transition-all active:scale-95 ${
                    isChecked ? 'bg-green-500 border-green-500 text-white shadow-sm' : 'bg-gray-800 border-gray-600 text-gray-600'
                  }`}
                >✓</button>
              </div>

              {activeIds.map((exId, exIndex) => {
                const rowIncrement = getIncrement(exId)
                const rowData = matrix[exId]?.[setIndex] || { weight: 0, reps: 0 }
                const lastSession = getLastSession(exId)
                const lastMax = lastSession ? Math.max(...lastSession.sets.map(s => s.weight)) : null
                const exData = exercises.find(e => e.id === exId)
                const exSettings = exData?.settings
                const exStreak = exData?.computedStreak
                const deloadStatus = getDeloadStatus(exSettings, exStreak)
                const successStatus = getSuccessStatus(exSettings, exStreak)
                const maintenanceStatus = getMaintenanceStatus(exSettings, exStreak)
                const isSettingsOpen = settingsOpenFor === exId && settingsOpenForSetIndex === setIndex

                return (
                  <Fragment key={exId}>
                    <div className="flex items-center justify-between gap-2 bg-gray-800 p-2 rounded-xl border border-gray-700">
                      <div className="w-1/3 pr-2 min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          <span className="text-gray-500 mr-2">{String.fromCharCode(65 + exIndex)}</span>
                          {getExerciseName(exId)}
                        </div>
                        {lastMax !== null && (
                          <div className="text-[9px] text-gray-500 font-semibold mt-0.5 truncate">
                            Last: {lastMax}kg
                          </div>
                        )}
                        {successStatus && <SuccessBadge status={successStatus} compact />}
                        {maintenanceStatus && <MaintenanceBadge status={maintenanceStatus} compact />}
                        {deloadStatus && <DeloadBadge status={deloadStatus} compact />}
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsOpenFor(isSettingsOpen ? null : exId)
                            setSettingsOpenForSetIndex(isSettingsOpen ? null : setIndex)
                          }}
                          className="mt-1 text-[9px] text-gray-500 hover:text-gray-300 font-bold transition-colors block"
                          title="Exercise settings"
                        >⚙ Settings</button>
                      </div>

                      <div className="flex items-center bg-gray-700 rounded-lg border border-gray-600 flex-1">
                        <button type="button" onClick={() => updateMatrixValue(exId, setIndex, 'weight', -rowIncrement)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-600 rounded-l-lg">-</button>
                        <div className="flex-1 text-center leading-tight">
                          <div className="font-bold text-white text-sm">{Number(rowData.weight.toFixed(2))}</div>
                          <div className="text-[9px] text-gray-500 font-semibold uppercase">kg</div>
                        </div>
                        <button type="button" onClick={() => updateMatrixValue(exId, setIndex, 'weight', rowIncrement)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-600 rounded-r-lg">+</button>
                      </div>

                      <div className="flex items-center bg-gray-700 rounded-lg border border-gray-600 flex-1">
                        <button type="button" onClick={() => updateMatrixValue(exId, setIndex, 'reps', -1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-600 rounded-l-lg">-</button>
                        <div className="flex-1 text-center leading-tight">
                          <div className="font-bold text-white text-sm">{rowData.reps}</div>
                          <div className="text-[9px] text-gray-500 font-semibold uppercase">reps</div>
                        </div>
                        <button type="button" onClick={() => updateMatrixValue(exId, setIndex, 'reps', 1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-600 rounded-r-lg">+</button>
                      </div>
                    </div>
                    {isSettingsOpen && (
                      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-xs text-white">Settings: {getExerciseName(exId)}</h4>
                          <button type="button" onClick={() => { setSettingsOpenFor(null); setSettingsOpenForSetIndex(null) }} className="text-gray-400 font-bold text-xs">Cancel</button>
                        </div>
                        <form action={(fd: FormData) => handleSettingsSave(exId, fd)}>
                          <ExerciseSettingsFields settings={exSettings} exerciseId={exId} exerciseName={getExerciseName(exId)} />
                          <button type="submit" disabled={isSavingSettings} className="w-full bg-white text-black font-bold rounded-lg py-2.5 mt-3 text-sm active:scale-95 transition-all disabled:opacity-50">
                            {isSavingSettings ? 'Saving...' : 'Save Settings'}
                          </button>
                        </form>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          )
          })}

          <div className="flex gap-2">
            {!isEditing && (
              <button type="button" onClick={() => setMode('setup')} className="bg-gray-100 text-gray-600 font-bold px-4 rounded-xl hover:bg-gray-200 transition-colors">
                Back
              </button>
            )}
            <button type="button" onClick={handleSave} disabled={isSubmitting} className="flex-1 bg-blue-600 text-white font-bold rounded-xl py-4 shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50">
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Superset'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
