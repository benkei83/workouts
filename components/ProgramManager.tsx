'use client'

import { useState, useTransition } from 'react'
import {
  createProgram,
  updateProgram,
  deleteProgram,
  addProgramExercise,
  addSupersetToProgram,
  removeProgramExercise,
  fetchProgramById,
} from '@/app/workout/actions'

type Exercise = { id: string; name: string }
type SupersetTemplate = { id: string; name: string }
type ProgramExercise = {
  id: string
  exercise_id: string | null
  sort_order: number
  exercises: Exercise | null
  superset_template_id?: string | null
  superset_templates?: SupersetTemplate | null
}
type ProgramWorkout = { id: string; name: string; rotation_order: number; program_exercises: ProgramExercise[] }
type Program = {
  id: string
  name: string
  description: string | null
  program_workouts: ProgramWorkout[]
}
type ActiveProgram = { program_id: string; current_rotation_index: number } | null

export default function ProgramManager({
  initialPrograms,
  exercises,
  supersetTemplates = [],
  activeProgram,
}: {
  initialPrograms: Program[]
  exercises: Exercise[]
  supersetTemplates?: SupersetTemplate[]
  userId: string
  activeProgram: ActiveProgram
}) {
  const [programs, setPrograms] = useState(initialPrograms)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  const [activeDay, setActiveDay] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const res = await createProgram(formData)
      if (res?.error) {
        alert(`Error: ${res.error}`)
        return
      }
      setIsCreateOpen(false)
      window.location.reload()
    })
  }

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateProgram(formData)
      if (res?.error) {
        alert(`Error: ${res.error}`)
        return
      }
      setEditingProgram(null)
      window.location.reload()
    })
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this program? This cannot be undone.')) return
    startTransition(async () => {
      await deleteProgram(id)
      setPrograms(prev => prev.filter(p => p.id !== id))
    })
  }

  const handleAddExercise = (programWorkoutId: string, exerciseId: string, currentCount: number) => {
    startTransition(async () => {
      const res = await addProgramExercise(programWorkoutId, exerciseId, currentCount + 1)
      if (res?.error) { alert(`Error: ${res.error}`); return }
      if (editingProgram) {
        const fresh = await fetchProgramById(editingProgram.id)
        if (fresh) setEditingProgram(fresh as Program)
      }
    })
  }

  const handleAddSuperset = (programWorkoutId: string, supersetTemplateId: string, currentCount: number) => {
    startTransition(async () => {
      const res = await addSupersetToProgram(programWorkoutId, supersetTemplateId, currentCount + 1)
      if (res?.error) { alert(`Error: ${res.error}`); return }
      if (editingProgram) {
        const fresh = await fetchProgramById(editingProgram.id)
        if (fresh) setEditingProgram(fresh as Program)
      }
    })
  }

  const handleRemoveExercise = (programExerciseId: string) => {
    startTransition(async () => {
      await removeProgramExercise(programExerciseId)
      if (editingProgram) {
        const fresh = await fetchProgramById(editingProgram.id)
        if (fresh) setEditingProgram(fresh as Program)
      }
    })
  }

  const openEdit = async (program: Program) => {
    setActiveDay(0)
    setIsLoadingEdit(true)
    setEditingProgram(program)
    const fresh = await fetchProgramById(program.id)
    if (fresh) setEditingProgram(fresh as Program)
    setIsLoadingEdit(false)
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setIsCreateOpen(true)}
        className="w-full bg-black text-white font-bold py-4 rounded-2xl shadow-sm hover:bg-gray-800 transition-colors active:scale-[0.98]"
      >
        + New Program
      </button>

      <div className="space-y-3">
        {programs.map(program => {
          const split = program.program_workouts?.length || 1
          const isActive = activeProgram?.program_id === program.id
          const currentDay = isActive ? activeProgram!.current_rotation_index : 0
          const nextDayName = program.program_workouts?.find(pw => pw.rotation_order === currentDay + 1)?.name

          return (
            <div
              key={program.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:border-gray-300 transition-colors group"
              onClick={() => openEdit(program)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{program.name}</h3>
                  {isActive && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {split}-day split
                  {isActive && nextDayName ? ` • Next: ${nextDayName}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-gray-300 group-hover:text-gray-900 transition-colors p-2">✏️</span>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(program.id) }}
                  className="text-gray-300 hover:text-red-500 font-bold p-2 transition-colors text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}

        {programs.length === 0 && (
          <p className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-dashed border-gray-300 text-sm font-medium">
            No programs yet. Create one above.
          </p>
        )}
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">New Program</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 font-bold p-2">✕</button>
            </div>
            <form action={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Program Name</label>
                <input
                  type="text" name="name" required autoFocus
                  placeholder="e.g., Push / Pull / Legs"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description (optional)</label>
                <input
                  type="text" name="description"
                  placeholder="e.g., Classic 3-day hypertrophy split"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Split Type</label>
                <select name="split" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none">
                  <option value="1">1-day (same workout every session)</option>
                  <option value="2">2-day split (A / B alternating)</option>
                  <option value="3">3-day split (A / B / C rotating)</option>
                </select>
              </div>
              <button
                type="submit" disabled={isPending}
                className="w-full bg-black text-white font-bold rounded-xl py-4 mt-2 disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {isPending ? 'Creating...' : 'Create Program'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingProgram && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingProgram.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingProgram.program_workouts?.length || 1}-day split
                </p>
              </div>
              <button onClick={() => setEditingProgram(null)} className="text-gray-400 font-bold p-2 flex-shrink-0">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {isLoadingEdit && (
                <p className="text-sm text-gray-400 text-center animate-pulse py-2">Loading program data...</p>
              )}

              {/* Name / description */}
              <form action={handleUpdate} className="space-y-3">
                <input type="hidden" name="id" value={editingProgram.id} />
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Name</label>
                  <input
                    type="text" name="name" required defaultValue={editingProgram.name}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-bold focus:ring-2 focus:ring-black outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
                  <input
                    type="text" name="description" defaultValue={editingProgram.description || ''}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-black outline-none text-sm"
                  />
                </div>
                <button
                  type="submit" disabled={isPending}
                  className="w-full bg-gray-900 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {isPending ? 'Saving...' : 'Save Details'}
                </button>
              </form>

              {/* Day tabs */}
              {(editingProgram.program_workouts?.length || 0) > 1 && (
                <div className="flex gap-2 border-b border-gray-100 pb-3">
                  {(editingProgram.program_workouts || [])
                    .sort((a, b) => a.rotation_order - b.rotation_order)
                    .map((pw, i) => (
                      <button
                        key={pw.id}
                        onClick={() => setActiveDay(i)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                          activeDay === i ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {pw.name}
                      </button>
                    ))}
                </div>
              )}

              {/* Exercise list for active day */}
              {!isLoadingEdit && (editingProgram.program_workouts || []).length === 0 && (
                <p className="text-sm text-red-400 text-center py-2">Could not load workout days. Try closing and reopening.</p>
              )}
              {(editingProgram.program_workouts || [])
                .sort((a, b) => a.rotation_order - b.rotation_order)
                .map((pw, i) => {
                  if (i !== activeDay) return null
                  const sortedExercises = [...(pw.program_exercises || [])].sort((a, b) => a.sort_order - b.sort_order)
                  const availableExercises = exercises.filter(ex => !sortedExercises.some(pe => pe.exercise_id === ex.id))

                  return (
                    <div key={pw.id} className="space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{pw.name} — Exercises</p>

                      {sortedExercises.length === 0 && (
                        <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-xl">No exercises yet.</p>
                      )}

                      {sortedExercises.map(pe => (
                        <div key={pe.id} className={`flex justify-between items-center rounded-xl px-4 py-3 ${pe.superset_template_id ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                          <div>
                            {pe.superset_template_id ? (
                              <>
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">🔄 Superset</p>
                                <p className="font-bold text-sm text-gray-900">{(pe as any).superset_templates?.name || 'Superset'}</p>
                              </>
                            ) : (
                              <span className="font-bold text-sm text-gray-900">{pe.exercises?.name}</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveExercise(pe.id)}
                            disabled={isPending}
                            className="text-gray-300 hover:text-red-500 font-bold text-lg transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {/* Add single exercise */}
                      {availableExercises.length > 0 && (
                        <div className="flex gap-2 pt-1">
                          <select
                            id={`add-exercise-${pw.id}`}
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                          >
                            {availableExercises.map(ex => (
                              <option key={ex.id} value={ex.id}>{ex.name}</option>
                            ))}
                          </select>
                          <button
                            disabled={isPending}
                            onClick={() => {
                              const sel = document.getElementById(`add-exercise-${pw.id}`) as HTMLSelectElement
                              if (sel?.value) handleAddExercise(pw.id, sel.value, sortedExercises.length)
                            }}
                            className="bg-black text-white font-bold px-4 rounded-xl text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      )}

                      {/* Add superset template */}
                      {supersetTemplates.length > 0 && (
                        <div className="flex gap-2">
                          <select
                            id={`add-superset-${pw.id}`}
                            className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 text-blue-700"
                          >
                            {supersetTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button
                            disabled={isPending}
                            onClick={() => {
                              const sel = document.getElementById(`add-superset-${pw.id}`) as HTMLSelectElement
                              if (sel?.value) handleAddSuperset(pw.id, sel.value, sortedExercises.length)
                            }}
                            className="bg-blue-600 text-white font-bold px-3 rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            + Superset
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
