'use client'

import { useState } from 'react'
import { saveStrengthExercise } from '@/app/workout/actions'

type SetData = { weight: number, reps: number }
type Exercise = { id: string, name: string }

export default function StrengthForm({ 
  workoutId, 
  exercises,
  onCancel 
}: { 
  workoutId: string, 
  exercises: Exercise[],
  onCancel: () => void 
}) {
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]?.id || '')
  const [sets, setSets] = useState<SetData[]>([{ weight: 60, reps: 8 }])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handlers for the Sweaty-Hands UI
  const updateSet = (index: number, field: 'weight' | 'reps', delta: number) => {
    const newSets = [...sets]
    newSets[index][field] = Math.max(0, newSets[index][field] + delta)
    setSets(newSets)
  }

  const addSet = () => {
    // Copy the weight and reps from the previous set
    const lastSet = sets[sets.length - 1]
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">🏋️ Log Lifts</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      {/* Exercise Selector */}
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

      {/* The Set Logger */}
      <div className="space-y-4 mb-6">
        {sets.map((set, index) => (
          <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 relative group">
            
            {/* Delete button (shows when multiple sets exist) */}
            {sets.length > 1 && (
              <button onClick={() => removeSet(index)} className="absolute -left-2 -top-2 bg-red-100 text-red-600 rounded-full w-6 h-6 text-xs font-bold shadow-sm">✕</button>
            )}
            
            <div className="font-bold text-gray-400 w-6 text-center">{index + 1}</div>
            
            {/* Weight Controls */}
            <div className="flex-1 flex items-center justify-between bg-white rounded-lg border border-gray-200 p-1">
              <button onClick={() => updateSet(index, 'weight', -2.5)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-md">-</button>
              <div className="text-center font-bold text-lg w-16">{set.weight}<span className="text-xs text-gray-400 block -mt-1">kg</span></div>
              <button onClick={() => updateSet(index, 'weight', 2.5)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-md">+</button>
            </div>

            <div className="text-gray-300 font-bold">×</div>

            {/* Reps Controls */}
            <div className="flex-1 flex items-center justify-between bg-white rounded-lg border border-gray-200 p-1">
              <button onClick={() => updateSet(index, 'reps', -1)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-md">-</button>
              <div className="text-center font-bold text-lg w-12">{set.reps}<span className="text-xs text-gray-400 block -mt-1">reps</span></div>
              <button onClick={() => updateSet(index, 'reps', 1)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-md">+</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addSet} className="w-full border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-xl py-3 mb-4 hover:border-black transition-colors">
        + Add Set
      </button>

      <button onClick={handleSave} disabled={isSubmitting} className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50">
        {isSubmitting ? 'Saving...' : 'Save Exercise'}
      </button>
    </div>
  )
}