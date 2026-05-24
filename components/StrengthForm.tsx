'use client'

import { useState } from 'react'
import { saveStrengthExercise, deleteStrengthLog, createCustomExercise } from '@/app/workout/actions'

type SetData = { weight: number, reps: number }
type Exercise = { id: string, name: string }

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
  
  // NEW: State for the inline creator
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  const [sets, setSets] = useState<SetData[]>(() => {
    if (editData?.rawSets) return editData.rawSets
    return Array.from({ length: initialSets }, () => ({
      weight: initialWeight,
      reps: initialReps
    }))
  })

  // --- INLINE CREATION LOGIC ---
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
      setSelectedExercise(res.id) // Instantly auto-select the new creation
      setIsCreatingNew(false)
    } else {
      alert("Failed to create exercise.")
    }
    setIsSubmitting(false)
  }

  // --- STANDARD HANDLERS ---
  const updateSet = (index: number, field: 'weight' | 'reps', delta: number) => {
    const newSets = [...sets]
    newSets[index][field] = Math.max(0, newSets[index][field] + delta)
    setSets(newSets)
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
    
    const result = await saveStrengthExercise(workoutId, selectedExercise, sets)
    setIsSubmitting(false)

    if (result?.error) {
      alert(`Database Error: ${result.error}`)
    } else {
      onCancel() 
    }
  }

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">🏋️ {editData ? 'Edit' : 'Log'} Lifts</h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exercise</label>
        
        {/* NEW: Dynamic Select / Input Toggle */}
        {!isCreatingNew ? (
          <div className="flex gap-2">
            <select 
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:ring-2 focus:ring-black appearance-none truncate"
            >
              {exercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <button 
              type="button" 
              onClick={() => setIsCreatingNew(true)} 
              className="bg-gray-100 text-gray-600 font-bold px-4 rounded-xl hover:bg-gray-200 transition-colors shadow-sm"
              title="Add new exercise"
            >
              +
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input 
              id="new-exercise-input"
              type="text" 
              placeholder="e.g., T-Bar Row" 
              className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:ring-2 focus:ring-black"
              autoFocus
            />
            <button 
              type="button" 
              onClick={handleInlineCreate} 
              disabled={isSubmitting} 
              className="bg-black text-white font-bold px-4 rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? '...' : 'Save'}
            </button>
            <button 
              type="button" 
              onClick={() => setIsCreatingNew(false)} 
              className="bg-gray-100 text-gray-500 font-bold px-4 rounded-xl hover:bg-gray-200 transition-colors"
            >
              ✕
            </button>
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
              <button type="button" onClick={() => updateSet(index, 'weight', -2.5)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
              <div className="text-center w-12 leading-tight">
                <div className="font-bold text-gray-900">{set.weight}</div>
                <div className="text-[10px] text-gray-400 font-semibold uppercase">kg</div>
              </div>
              <button type="button" onClick={() => updateSet(index, 'weight', 2.5)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
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

      <button type="button" onClick={handleSave} disabled={isSubmitting || isCreatingNew} className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50">
        {isSubmitting ? 'Saving...' : (editData ? 'Update Exercise' : 'Save Exercise')}
      </button>
    </div>
  )
}