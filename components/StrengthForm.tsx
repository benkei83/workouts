'use client'

import { useState } from 'react'
import { saveStrengthExercise } from '@/app/workout/actions'

type SetData = { weight: number, reps: number }
type Exercise = { id: string, name: string }

export default function StrengthForm({ 
  workoutId, 
  exercises,
  onCancel,
  // NEW: Setting up standard parameters. 
  // Later, we will fetch these from your 'user_exercise_settings' table!
  initialSets = 5,
  initialReps = 5,
  initialWeight = 60
}: { 
  workoutId: string, 
  exercises: Exercise[],
  onCancel: () => void,
  initialSets?: number,
  initialReps?: number,
  initialWeight?: number
}) {
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]?.id || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize with the standard sets automatically
  const [sets, setSets] = useState<SetData[]>(() => 
    Array.from({ length: initialSets }, () => ({
      weight: initialWeight,
      reps: initialReps
    }))
  )

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
    await saveStrengthExercise(workoutId, selectedExercise, sets)
    setIsSubmitting(false)
    onCancel()
  }

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">🏋️ Log Lifts</h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exercise</label>
        <select 
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:ring-2 focus:ring-black appearance-none"
        >
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3 mb-6">
        {sets.map((set, index) => (
          // Adjusted gap and padding for tight mobile fit
          <div key={index} className="flex items-center justify-between gap-1 bg-gray-50 p-2 rounded-xl border border-gray-100 relative group">
            
            {sets.length > 1 && (
              <button type="button" onClick={() => removeSet(index)} className="absolute -left-2 -top-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm">✕</button>
            )}
            
            <div className="font-bold text-gray-400 w-4 text-center text-sm">{index + 1}</div>
            
            {/* Weight Controls: Fixed widths, explicit text-gray-900 */}
            <div className="flex items-center bg-white rounded-lg border border-gray-200">
              <button type="button" onClick={() => updateSet(index, 'weight', -2.5)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
              <div className="text-center w-12 leading-tight">
                <div className="font-bold text-gray-900">{set.weight}</div>
                <div className="text-[10px] text-gray-400 font-semibold uppercase">kg</div>
              </div>
              <button type="button" onClick={() => updateSet(index, 'weight', 2.5)} className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
            </div>

            <div className="text-gray-300 font-bold text-sm px-1">×</div>

            {/* Reps Controls: Fixed widths, explicit text-gray-900 */}
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

      <button type="button" onClick={handleSave} disabled={isSubmitting} className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50">
        {isSubmitting ? 'Saving...' : 'Save Exercise'}
      </button>
    </div>
  )
}