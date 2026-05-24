'use client'

import { useState, useTransition } from 'react'
import { createCustomExercise, updateExerciseSettings, deleteExercise } from '@/app/workout/actions' // Added delete import

type Exercise = {
  id: string
  name: string
  category: string
  user_id: string | null
  settings: any | null
}

export default function ExerciseManager({ initialExercises }: { initialExercises: Exercise[] }) {
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredExercises = initialExercises.filter(e => 
    e.category === 'strength' && e.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createCustomExercise(formData)
      setIsCreateOpen(false)
    })
  }

  const handleUpdateSettings = (formData: FormData) => {
    if (!editingExercise) return
    startTransition(async () => {
      await updateExerciseSettings(editingExercise.id, {
        sets: parseInt(formData.get('sets') as string) || 5,
        reps: parseInt(formData.get('reps') as string) || 5,
        weight: parseFloat(formData.get('weight') as string) || 0,
        increment: parseFloat(formData.get('increment') as string) || 2.5
      })
      setEditingExercise(null)
    })
  }

  // NEW: Delete handler
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this exercise? This will remove it from all past workouts.')) {
      startTransition(() => {
        deleteExercise(id)
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Search exercises..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-black"
        />
        <button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-black text-white font-bold px-4 rounded-xl shadow-sm hover:bg-gray-800 transition-colors"
        >
          + New
        </button>
      </div>

      <div className="space-y-3">
        {filteredExercises.map(ex => (
          <div 
            key={ex.id} 
            onClick={() => setEditingExercise(ex)}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:border-gray-300 transition-colors group"
          >
            <div>
              <h3 className="font-bold text-gray-900">{ex.name}</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">
                {ex.settings 
                  ? `${ex.settings.target_sets} sets • ${ex.settings.target_reps} reps • Target: ${ex.settings.current_weight}kg` 
                  : 'No targets set'}
              </p>
            </div>
            
            {/* UPDATED ACTION BUTTONS */}
            <div className="flex items-center gap-1">
              <span className="text-gray-300 group-hover:text-gray-900 transition-colors p-2">✏️</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDelete(ex.id) }}
                className="text-gray-300 hover:text-red-500 font-bold p-2 transition-colors text-lg"
              >✕</button>
            </div>
          </div>
        ))}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add Exercise</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 font-bold p-2">✕</button>
            </div>
            <form action={handleCreate} className="space-y-4">
              <input type="hidden" name="category" value="strength" />
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Exercise Name</label>
                <input type="text" name="name" required placeholder="e.g., Deficit Deadlift" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none" />
              </div>
              <button type="submit" disabled={isPending} className="w-full bg-black text-white font-bold rounded-xl py-4 mt-2 disabled:opacity-50">
                {isPending ? 'Saving...' : 'Create Exercise'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingExercise && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingExercise.name}</h2>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">Set Baseline Targets</p>
              </div>
              <button onClick={() => setEditingExercise(null)} className="text-gray-400 font-bold p-2">✕</button>
            </div>
            
            <form action={handleUpdateSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Default Sets</label>
                  <input type="number" name="sets" required defaultValue={editingExercise.settings?.target_sets || 5} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Default Reps</label>
                  <input type="number" name="reps" required defaultValue={editingExercise.settings?.target_reps || 5} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Target Weight (kg)</label>
                  <input type="number" step="0.5" name="weight" required defaultValue={editingExercise.settings?.current_weight || 60} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Progression Step</label>
                  <input type="number" step="0.5" name="increment" required defaultValue={editingExercise.settings?.increment_step || 2.5} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none" />
                </div>
              </div>
              <button type="submit" disabled={isPending} className="w-full bg-black text-white font-bold rounded-xl py-4 mt-2 disabled:opacity-50">
                {isPending ? 'Updating...' : 'Save Targets'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}