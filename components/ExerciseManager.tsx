'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  createCustomExercise,
  updateExerciseSettings,
  updateExerciseMeta,
  deleteExercise,
} from '@/app/workout/actions'
import { fetchExerciseHistory } from '@/app/exercises/actions'
import ExerciseSettingsFields from '@/components/ExerciseSettingsFields'
import WgerBrowseModal, { type WgerItem } from '@/components/WgerBrowseModal'
import ExerciseStatsPanel from '@/components/stats/ExerciseStatsPanel'
import { MUSCLE_GROUPS, EQUIPMENT_LABELS } from '@/lib/muscleGroups'
import type { ExerciseHistorySession } from '@/lib/stats/compute'

type Exercise = {
  id: string
  name: string
  category: string
  user_id: string | null
  muscle_group: string | null
  equipment: string | null
  settings: any | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MG_LABELS: Record<string, string> = Object.fromEntries(MUSCLE_GROUPS.map(g => [g.id, g.label]))
const MG_COLORS: Record<string, string> = {
  chest:     'bg-red-50 text-red-600 border-red-100',
  back:      'bg-blue-50 text-blue-600 border-blue-100',
  shoulders: 'bg-purple-50 text-purple-600 border-purple-100',
  arms:      'bg-orange-50 text-orange-600 border-orange-100',
  legs:      'bg-green-50 text-green-600 border-green-100',
  core:      'bg-yellow-50 text-yellow-700 border-yellow-100',
  calves:    'bg-teal-50 text-teal-600 border-teal-100',
}

function MgChip({ id }: { id: string | null }) {
  if (!id || !MG_LABELS[id]) return null
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${MG_COLORS[id] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
      {MG_LABELS[id]}
    </span>
  )
}
function EqChip({ id }: { id: string | null }) {
  if (!id || !EQUIPMENT_LABELS[id]) return null
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
      {EQUIPMENT_LABELS[id]}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExerciseManager({ initialExercises }: { initialExercises: Exercise[] }) {
  const [exercises, setExercises] = useState(initialExercises)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [isWgerOpen, setIsWgerOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistorySession[] | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Fetch history whenever the modal opens for a different exercise
  useEffect(() => {
    if (!editingExercise) { setExerciseHistory(null); return }
    setExerciseHistory(null)
    setIsLoadingHistory(true)
    fetchExerciseHistory(editingExercise.id)
      .then(h => setExerciseHistory(h))
      .finally(() => setIsLoadingHistory(false))
  }, [editingExercise?.id])

  const libraryNames = useMemo(
    () => new Set(exercises.map(e => e.name.toLowerCase())),
    [exercises]
  )

  const filtered = exercises.filter(e => {
    if (e.category !== 'strength') return false
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    if (muscleFilter && e.muscle_group !== muscleFilter) return false
    return true
  })

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleWgerAdded = (item: WgerItem, id: string) => {
    setExercises(prev => [...prev, {
      id,
      name: item.name,
      category: 'strength',
      user_id: null,
      muscle_group: item.muscle_group,
      equipment: item.equipment,
      settings: null,
    }])
  }

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      await createCustomExercise(formData)
      setIsCreateOpen(false)
    })
  }

  const handleUpdateSettings = (formData: FormData) => {
    if (!editingExercise) return
    const prMinRaw = formData.get('pr_min_weight') as string
    const newSettings = {
      sets: parseInt(formData.get('sets') as string) || 5,
      reps: parseInt(formData.get('reps') as string) || 5,
      reps_min: parseInt(formData.get('reps_min') as string) || 8,
      weight: parseFloat(formData.get('weight') as string) || 0,
      increment: parseFloat(formData.get('increment') as string) || 2.5,
      progression_rate: parseFloat(formData.get('progression_rate') as string) || 2.5,
      protocol: formData.get('protocol') as string,
      min_successes: parseInt(formData.get('min_successes') as string) || 1,
      max_failures: parseInt(formData.get('max_failures') as string) || 3,
      deload_multiplier: parseFloat(formData.get('deload_multiplier') as string) || 2.0,
      current_failures: editingExercise.settings?.current_failures || 0,
      current_successes: editingExercise.settings?.current_successes || 0,
      suppress_prs: formData.get('suppress_prs') === 'on',
      pr_min_weight: prMinRaw ? parseFloat(prMinRaw) || null : null,
    }
    startTransition(async () => {
      await updateExerciseSettings(editingExercise.id, newSettings)
      // Update local state so modal shows correct values if reopened
      setExercises(prev => prev.map(e =>
        e.id === editingExercise.id
          ? { ...e, settings: { ...e.settings, ...newSettings, target_sets: newSettings.sets, target_reps: newSettings.reps, current_weight: newSettings.weight } }
          : e
      ))
      setEditingExercise(null)
    })
  }

  const [metaError, setMetaError] = useState<string | null>(null)

  const handleUpdateMeta = (formData: FormData) => {
    if (!editingExercise) return
    const mg = (formData.get('muscle_group') as string) || null
    const eq = (formData.get('equipment') as string) || null
    setMetaError(null)
    startTransition(async () => {
      const result = await updateExerciseMeta(editingExercise.id, mg, eq)
      if ('error' in result) {
        setMetaError(result.error === 'rls'
          ? 'Save blocked — add an UPDATE policy for the exercises table in Supabase.'
          : (result.error ?? 'Unknown error')
        )
        return
      }
      setExercises(prev => prev.map(e => e.id === editingExercise.id ? { ...e, muscle_group: mg, equipment: eq } : e))
      setEditingExercise(null)
    })
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this exercise? It will be removed from all past workouts.')) return
    const removed = exercises.find(e => e.id === id)
    setExercises(prev => prev.filter(e => e.id !== id))
    startTransition(async () => {
      const result = await deleteExercise(id)
      if ('error' in result) {
        if (removed) setExercises(prev => [...prev, removed])
        alert(result.error === 'rls'
          ? 'Delete blocked — add a DELETE policy for the exercises table in Supabase.'
          : (result.error ?? 'Failed to delete exercise')
        )
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Top bar — search on one row, action buttons on the next */}
      <input
        type="text"
        placeholder="Search exercises..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-black"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setIsWgerOpen(true)}
          className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl shadow-sm hover:bg-blue-700 transition-colors text-sm"
        >
          + From wger
        </button>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex-1 bg-black text-white font-bold py-2.5 rounded-xl shadow-sm hover:bg-gray-800 transition-colors text-sm"
        >
          + Custom
        </button>
      </div>

      {/* Muscle group filter chips */}
      <div className="flex gap-2 flex-wrap">
        {[{ id: null, label: 'All' }, ...MUSCLE_GROUPS].map(g => (
          <button
            key={g.id ?? 'all'}
            onClick={() => setMuscleFilter(g.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              muscleFilter === g.id
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Library list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-sm">No exercises found.</p>
        ) : (
          filtered.map(ex => (
            <div
              key={ex.id}
              onClick={() => setEditingExercise(ex)}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-start cursor-pointer hover:border-gray-300 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-900 leading-snug">{ex.name}</h3>
                {(ex.muscle_group || ex.equipment) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <MgChip id={ex.muscle_group} />
                    <EqChip id={ex.equipment} />
                  </div>
                )}
                <p className="text-sm font-medium text-gray-400 mt-1.5">
                  {ex.settings
                    ? `${ex.settings.target_sets} sets · ${ex.settings.target_reps} reps · ${ex.settings.current_weight}kg`
                    : 'No targets set'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <span className="text-gray-300 group-hover:text-gray-900 transition-colors p-2">✏️</span>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(ex.id) }}
                  className="text-gray-300 hover:text-red-500 font-bold p-2 transition-colors text-lg"
                >✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* wger browse modal */}
      {isWgerOpen && (
        <WgerBrowseModal
          libraryNames={libraryNames}
          onClose={() => setIsWgerOpen(false)}
          onAdded={handleWgerAdded}
        />
      )}

      {/* Create custom modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Custom Exercise</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 font-bold p-2">✕</button>
            </div>
            <form action={handleCreate} className="space-y-4">
              <input type="hidden" name="category" value="strength" />
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Name</label>
                <input type="text" name="name" required placeholder="e.g., Deficit Deadlift"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Muscle Group</label>
                <select name="muscle_group" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none">
                  <option value="">— none —</option>
                  {MUSCLE_GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Equipment</label>
                <select name="equipment" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none">
                  <option value="">— none —</option>
                  {Object.entries(EQUIPMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <button type="submit" disabled={isPending}
                className="w-full bg-black text-white font-bold rounded-xl py-4 disabled:opacity-50">
                {isPending ? 'Saving...' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingExercise && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingExercise.name}</h2>
                <Link
                  href={`/exercises/${editingExercise.id}`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View full stats →
                </Link>
              </div>
              <button onClick={() => setEditingExercise(null)} className="text-gray-400 font-bold p-2 mt-[-4px]">✕</button>
            </div>
            <div className="px-6 py-5 space-y-6">

              {/* Stats */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Stats</p>
                {isLoadingHistory ? (
                  <div className="animate-pulse space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
                      ))}
                    </div>
                    <div className="h-44 bg-gray-100 rounded-xl" />
                  </div>
                ) : exerciseHistory !== null ? (
                  <ExerciseStatsPanel
                    history={exerciseHistory}
                    targetReps={editingExercise.settings?.target_reps ?? null}
                  />
                ) : null}
              </div>

              {/* Tags */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tags</p>
                <form action={handleUpdateMeta} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Muscle Group</label>
                    <select name="muscle_group" defaultValue={editingExercise.muscle_group ?? ''}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none">
                      <option value="">— none —</option>
                      {MUSCLE_GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Equipment</label>
                    <select name="equipment" defaultValue={editingExercise.equipment ?? ''}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none">
                      <option value="">— none —</option>
                      {Object.entries(EQUIPMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                  <button type="submit" disabled={isPending}
                    className="w-full bg-gray-800 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-50 hover:bg-black transition-colors">
                    {isPending ? 'Saving…' : 'Save Tags'}
                  </button>
                  {metaError && (
                    <p className="text-xs text-red-500 font-semibold mt-2">{metaError}</p>
                  )}
                </form>
              </div>
              {/* Training settings */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Training Settings</p>
                <form action={handleUpdateSettings} className="space-y-4">
                  <ExerciseSettingsFields settings={editingExercise.settings} exerciseId={editingExercise.id} exerciseName={editingExercise.name} />

                  {/* PR notifications */}
                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">PR Notifications</p>

                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Suppress all PR badges</p>
                        <p className="text-xs text-gray-400 mt-0.5">Never mark sets as PRs for this exercise</p>
                      </div>
                      <input
                        type="checkbox"
                        name="suppress_prs"
                        defaultChecked={editingExercise.settings?.suppress_prs ?? false}
                        className="w-5 h-5 rounded accent-gray-900 cursor-pointer"
                      />
                    </label>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1">
                        Suppress until I lift at least
                      </label>
                      <p className="text-xs text-gray-400 mb-2">PRs are ignored until you reach this weight. Leave empty to disable.</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          name="pr_min_weight"
                          min="0"
                          step="2.5"
                          defaultValue={editingExercise.settings?.pr_min_weight ?? ''}
                          placeholder="e.g. 100"
                          className="w-32 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none"
                        />
                        <span className="text-sm text-gray-500 font-medium">kg</span>
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={isPending}
                    className="w-full bg-black text-white font-bold rounded-xl py-3 active:scale-95 transition-all disabled:opacity-50">
                    {isPending ? 'Updating...' : 'Save Settings'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
