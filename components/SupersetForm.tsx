'use client'

import { useState } from 'react'
import { saveSupersetLog, saveSupersetTemplate } from '@/app/workout/actions'

type Exercise = {
  id: string
  name: string
  increment_step?: number
  settings?: {
    current_weight?: number
    target_reps?: number
    target_sets?: number
    increment_step?: number
  } | null
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

type SetMatrix = { [exerciseId: string]: { weight: number, reps: number }[] }

export default function SupersetForm({
  workoutId,
  exercises,
  supersetTemplates = [],
  onCancel,
}: {
  workoutId: string
  exercises: Exercise[]
  supersetTemplates?: SupersetTemplate[]
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'setup' | 'logging'>('setup')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // SETUP STATE
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>(['', ''])
  const [targetSets, setTargetSets] = useState(3)

  // MATRIX STATE
  const [matrix, setMatrix] = useState<SetMatrix>({})

  // TEMPLATE SAVE STATE
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  const updateSelectedExercise = (index: number, value: string) => {
    const newSelected = [...selectedExerciseIds]
    newSelected[index] = value
    setSelectedExerciseIds(newSelected)
  }

  const addExerciseSlot = () => setSelectedExerciseIds([...selectedExerciseIds, ''])

  const removeExerciseSlot = (index: number) => {
    setSelectedExerciseIds(selectedExerciseIds.filter((_, i) => i !== index))
  }

  const loadFromTemplate = (templateId: string) => {
    const template = supersetTemplates.find(t => t.id === templateId)
    if (!template) return
    const sorted = [...template.superset_template_exercises].sort((a, b) => a.sort_order - b.sort_order)
    setSelectedExerciseIds(sorted.map(te => te.exercise_id))
  }

  const generateMatrix = () => {
    const validIds = selectedExerciseIds.filter(id => id !== '')
    if (validIds.length < 2) {
      alert("Please select at least two exercises for a superset.")
      return
    }

    const newMatrix: SetMatrix = {}
    validIds.forEach(id => {
      const ex = exercises.find(e => e.id === id)
      // Pre-fill from exercise settings
      const weight = ex?.settings?.current_weight ?? 0
      const reps = ex?.settings?.target_reps ?? 0
      newMatrix[id] = Array.from({ length: targetSets }, () => ({ weight, reps }))
    })

    setMatrix(newMatrix)
    setMode('logging')
  }

  const updateMatrixValue = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', delta: number) => {
    setMatrix(prev => {
      const updated = { ...prev }
      updated[exerciseId] = [...prev[exerciseId]]
      updated[exerciseId][setIndex] = {
        ...prev[exerciseId][setIndex],
        [field]: Math.max(0, prev[exerciseId][setIndex][field] + delta)
      }
      return updated
    })
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    const result = await saveSupersetLog(workoutId, matrix)
    setIsSubmitting(false)
    if (result && 'error' in result) {
      alert(`Error: ${result.error}`)
    } else {
      onCancel()
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    const validIds = selectedExerciseIds.filter(id => id !== '')
    if (validIds.length < 2) {
      alert("Select at least two exercises first.")
      return
    }
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

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">🔄 Log Superset</h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      {mode === 'setup' && (
        <div className="space-y-6">

          {/* Load from saved template */}
          {supersetTemplates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Load Template</label>
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold text-gray-900 text-sm outline-none"
                defaultValue=""
                onChange={e => { if (e.target.value) loadFromTemplate(e.target.value) }}
              >
                <option value="" disabled>Select a saved template...</option>
                {supersetTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Exercise picker */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Circuit Exercises</label>
            {selectedExerciseIds.map((exId, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center">
                  <span className="text-xs font-bold text-gray-400 mr-3">{String.fromCharCode(65 + index)}</span>
                  <select
                    value={exId}
                    onChange={(e) => updateSelectedExercise(index, e.target.value)}
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

          {/* Sets */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Sets</label>
            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 max-w-[150px]">
              <button type="button" onClick={() => setTargetSets(Math.max(1, targetSets - 1))} className="w-12 h-12 flex items-center justify-center font-bold text-gray-500 active:bg-gray-200 rounded-l-xl">-</button>
              <div className="flex-1 text-center font-bold text-xl text-gray-900">{targetSets}</div>
              <button type="button" onClick={() => setTargetSets(targetSets + 1)} className="w-12 h-12 flex items-center justify-center font-bold text-gray-500 active:bg-gray-200 rounded-r-xl">+</button>
            </div>
          </div>

          {/* Save as template */}
          {!showSaveTemplate ? (
            <button
              type="button"
              onClick={() => setShowSaveTemplate(true)}
              className="text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
            >
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
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || isSavingTemplate}
                className="bg-black text-white font-bold px-4 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-all"
              >
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

      {mode === 'logging' && (
        <div className="space-y-6">
          {Array.from({ length: targetSets }).map((_, setIndex) => (
            <div key={setIndex} className="bg-gray-900 rounded-2xl p-4 shadow-inner space-y-3">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-2">Set {setIndex + 1}</h4>

              {selectedExerciseIds.filter(id => id !== '').map((exId, exIndex) => {
                const exerciseDetails = exercises.find(e => e.id === exId)
                const exerciseName = exerciseDetails?.name || 'Exercise'
                const rowIncrement = exerciseDetails?.increment_step || exerciseDetails?.settings?.increment_step || 2.5
                const rowData = matrix[exId]?.[setIndex] || { weight: 0, reps: 0 }

                return (
                  <div key={exId} className="flex items-center justify-between gap-2 bg-gray-800 p-2 rounded-xl border border-gray-700">
                    <div className="text-xs font-bold text-white w-1/3 truncate pr-2">
                      <span className="text-gray-500 mr-2">{String.fromCharCode(65 + exIndex)}</span>
                      {exerciseName}
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
                )
              })}
            </div>
          ))}

          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('setup')} className="bg-gray-100 text-gray-600 font-bold px-4 rounded-xl hover:bg-gray-200 transition-colors">
              Back
            </button>
            <button type="button" onClick={handleSave} disabled={isSubmitting} className="flex-1 bg-blue-600 text-white font-bold rounded-xl py-4 shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save Superset'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
