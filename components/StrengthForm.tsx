'use client'

import { useState } from 'react'
import { saveStrengthExercise, deleteStrengthLog, createCustomExercise, updateExerciseSettings } from '@/app/workout/actions'

type SetData = { weight: number, reps: number }
type Exercise = { id: string, name: string, increment_step?: number, settings?: any }

export default function StrengthForm({ 
  workoutId, 
  exercises,
  onCancel,
  initialSets = 5,
  initialReps = 5,
  initialWeight = 60,
  editData 
}: { 
  workoutId: string, 
  exercises: Exercise[],
  onCancel: () => void,
  initialSets?: number,
  initialReps?: number,
  initialWeight?: number,
  editData?: any
}) {
  const [selectedExercise, setSelectedExercise] = useState(editData?.exerciseId || exercises[0]?.id || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uiMode, setUiMode] = useState<'select' | 'create' | 'edit_settings'>('select')

  const [sets, setSets] = useState<SetData[]>(() => {
    if (editData?.rawSets) return editData.rawSets
    return Array.from({ length: initialSets }, () => ({
      weight: initialWeight,
      reps: initialReps
    }))
  })

  const activeExerciseData = exercises.find(ex => ex.id === selectedExercise)
  const currentIncrement = activeExerciseData?.increment_step || 2.5

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
      setSelectedExercise(res.id)
      setUiMode('select')
    }
    setIsSubmitting(false)
  }

  const handleInlineSettingsSave = async (formData: FormData) => {
    setIsSubmitting(true)
    await updateExerciseSettings(selectedExercise, {
      sets: parseInt(formData.get('sets') as string) || 5,
      reps: parseInt(formData.get('reps') as string) || 5,
      weight: parseFloat(formData.get('weight') as string) || 0,
      increment: parseFloat(formData.get('increment') as string) || 2.5,
      progression_rate: parseFloat(formData.get('progression_rate') as string) || 2.5
    })
    setIsSubmitting(false)
    setUiMode('select')
  }

  const updateSet = (index: number, field: 'weight' | 'reps', delta: number) => {
    setSets(prev => {
      const newSets = [...prev]
      newSets[index] = { 
        ...newSets[index], 
        [field]: Math.max(0, newSets[index][field] + delta) 
      }
      return newSets
    })
  }

  const addSet = () => {
    const lastSet = sets[sets.length - 1] || { weight: initialWeight, reps: initialReps }
    setSets([...sets, { ...lastSet }])
  }

  const removeSet = (indexToRemove: number) => {
    setSets(sets.filter((_, index) => index !== indexToRemove))
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    if (editData) await deleteStrengthLog(editData.logId, workoutId)
    
    // Pass historical timestamps and superset mappings back to the database
    const result = await saveStrengthExercise(workoutId, selectedExercise, sets, {
      createdAt: editData?.createdAt,
      supersetId: editData?.supersetId
    })
    
    setIsSubmitting(false)
    if (result?.error) alert(`Database Error: ${result.error}`)
    else onCancel() 
  }

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">🏋️ {editData ? 'Edit' : 'Log'} Lifts</h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exercise</label>
        
        {uiMode === 'select' && (
          <div className="flex gap-2">
            <select 
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              // FIXED: min-w-0 added to prevent pushing icons off screen
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:ring-2 focus:ring-black appearance-none truncate"
            >
              {exercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <button 
              type="button" 
              onClick={() => setUiMode('edit_settings')} 
              className="bg-gray-100 text-gray-500 font-bold px-4 rounded-xl hover:bg-gray-200 transition-colors shadow-sm"
            >⚙️</button>
            <button 
              type="button" 
              onClick={() => setUiMode('create')} 
              className="bg-gray-100 text-gray-600 font-bold px-4 rounded-xl hover:bg-gray-200 transition-colors shadow-sm"
            >+</button>
          </div>
        )}

        {uiMode === 'create' && (
          <div className="flex gap-2">
            <input 
              id="new-exercise-input" type="text" placeholder="e.g., T-Bar Row" 
              className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:ring-2 focus:ring-black" autoFocus
            />
            <button type="button" onClick={handleInlineCreate} disabled={isSubmitting} className="bg-black text-white font-bold px-4 rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setUiMode('select')} className="bg-gray-100 text-gray-500 font-bold px-4 rounded-xl hover:bg-gray-200 transition-colors">✕</button>
          </div>
        )}

        {uiMode === 'edit_settings' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-sm text-gray-900">Edit Settings: {activeExerciseData?.name}</h4>
              <button type="button" onClick={() => setUiMode('select')} className="text-gray-400 font-bold text-sm">Cancel</button>
            </div>
            <form action={handleInlineSettingsSave} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Sets</label>
                <input type="number" name="sets" defaultValue={activeExerciseData?.settings?.target_sets || 5} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-bold mt-1" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Reps</label>
                <input type="number" name="reps" defaultValue={activeExerciseData?.settings?.target_reps || 5} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-bold mt-1" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Target Weight</label>
                <input type="number" step="0.5" name="weight" defaultValue={activeExerciseData?.settings?.current_weight || 60} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-bold mt-1" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase text-blue-500">UI Increment (+/-)</label>
                <input type="number" step="0.5" name="increment" defaultValue={activeExerciseData?.settings?.increment_step || 2.5} className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 font-bold mt-1" />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase text-green-500">Auto-Progression Rate</label>
                <input type="number" step="0.5" name="progression_rate" defaultValue={activeExerciseData?.settings?.progression_rate || 2.5} className="w-full bg-white border border-green-200 rounded-lg px-3 py-2 font-bold mt-1" />
              </div>
              <button type="submit" disabled={isSubmitting} className="col-span-2 bg-black text-white font-bold rounded-lg py-3 mt-2">{isSubmitting ? 'Saving...' : 'Save Settings'}</button>
            </form>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-6">
        {sets.map((set, index) => (
          <div key={index} className="flex items-center justify-between gap-1 bg-gray-50 p-2 rounded-xl border border-gray-100 relative group">
            {sets.length > 1 && (
              <button type="button" onClick={() => removeSet(index)} className="absolute -left-2 -top-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm">✕</button>
            )}
            <div className="font-bold text-gray-400 w-4 text-center text-sm">{index + 1}</div>
            
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
          </div>
        ))}
      </div>

      <button type="button" onClick={addSet} className="w-full border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-xl py-3 mb-4 hover:border-black transition-colors">
        + Add Set
      </button>

      <button type="button" onClick={handleSave} disabled={isSubmitting || uiMode !== 'select'} className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50">
        {isSubmitting ? 'Saving...' : (editData ? 'Update Exercise' : 'Save Exercise')}
      </button>
    </div>
  )
}