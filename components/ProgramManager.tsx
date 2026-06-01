'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import {
  createProgram,
  updateProgram,
  deleteProgram,
  addProgramExercise,
  addSupersetToProgram,
  removeProgramExercise,
  fetchProgramById,
  addWgerExercise,
  generateProgramShareToken,
  revokeProgramShareToken,
} from '@/app/workout/actions'
import { searchUsers, sendMessage } from '@/app/inbox/actions'
import { MUSCLE_GROUPS } from '@/lib/muscleGroups'
import WgerBrowseModal from '@/components/WgerBrowseModal'
import type { WgerItem } from '@/components/WgerBrowseModal'
import ExerciseSettingsCard from '@/components/exercises/ExerciseSettingsCard'
import { fetchExerciseForSettings } from '@/app/exercises/[id]/actions'

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
  share_token?: string | null
  program_workouts: ProgramWorkout[]
}
type ActiveProgram = { program_id: string; current_rotation_index: number } | null

type NewExerciseModal = { programWorkoutId: string; currentCount: number } | null

export default function ProgramManager({
  initialPrograms,
  exercises: initialExercises,
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
  const [exerciseList, setExerciseList] = useState<Exercise[]>(initialExercises)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  const [activeDay, setActiveDay] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [newExerciseModal, setNewExerciseModal] = useState<NewExerciseModal>(null)
  const [newExName, setNewExName] = useState('')
  const [newExMuscle, setNewExMuscle] = useState('')
  const [isCreatingEx, setIsCreatingEx] = useState(false)
  const [createExError, setCreateExError] = useState<string | null>(null)
  const [wgerModal, setWgerModal] = useState<NewExerciseModal>(null)

  type ShareModal = { programId: string; programName: string; token: string | null } | null
  const [shareModal, setShareModal] = useState<ShareModal>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareRevoking, setShareRevoking] = useState(false)

  const openShareModal = async (programId: string, programName: string, existingToken?: string | null) => {
    if (existingToken) {
      setShareModal({ programId, programName, token: existingToken })
      return
    }
    setShareLoading(true)
    setShareModal({ programId, programName, token: null })
    const res = await generateProgramShareToken(programId)
    if (res?.success && res.token) {
      setShareModal({ programId, programName, token: res.token })
      // Keep share_token in local program state too
      setPrograms(prev => prev.map(p => p.id === programId ? { ...p, share_token: res.token } : p))
    }
    setShareLoading(false)
  }

  const handleRevokeShare = async () => {
    if (!shareModal) return
    setShareRevoking(true)
    await revokeProgramShareToken(shareModal.programId)
    setPrograms(prev => prev.map(p => p.id === shareModal.programId ? { ...p, share_token: null } : p))
    setShareModal(null)
    setShareRevoking(false)
  }

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/programs/share/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  // Send-to-user state
  const [dmQuery, setDmQuery] = useState('')
  const [dmResults, setDmResults] = useState<{ user_id: string; screen_name: string | null }[]>([])
  const [dmSearching, startDmSearch] = useTransition()
  const [dmTarget, setDmTarget] = useState<{ user_id: string; screen_name: string | null } | null>(null)
  const [dmNote, setDmNote] = useState('')
  const [dmSending, startDmSend] = useTransition()
  const [dmSent, setDmSent] = useState<string | null>(null) // name of user sent to

  const handleDmSearch = (q: string) => {
    setDmQuery(q)
    setDmTarget(null)
    if (!q.trim()) { setDmResults([]); return }
    startDmSearch(async () => {
      const results = await searchUsers(q)
      setDmResults(results)
    })
  }

  const handleDmSend = (programId: string) => {
    if (!dmTarget) return
    startDmSend(async () => {
      const res = await sendMessage({ recipientId: dmTarget.user_id, body: dmNote, programId })
      if (res?.error) { alert(res.error); return }
      setDmSent(dmTarget.screen_name ?? 'user')
      setDmTarget(null); setDmQuery(''); setDmResults([]); setDmNote('')
      setTimeout(() => setDmSent(null), 3000)
    })
  }

  type ExSettingsData = Awaited<ReturnType<typeof fetchExerciseForSettings>>
  const [exSettingsModal, setExSettingsModal] = useState<ExSettingsData | null>(null)
  const [isLoadingExSettings, setIsLoadingExSettings] = useState(false)

  const openExerciseSettings = async (exerciseId: string) => {
    setIsLoadingExSettings(true)
    setExSettingsModal(null)
    const data = await fetchExerciseForSettings(exerciseId)
    setExSettingsModal(data)
    setIsLoadingExSettings(false)
  }

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

  const handleCreateAndAddExercise = async () => {
    if (!newExerciseModal || !newExName.trim()) return
    setIsCreatingEx(true)
    setCreateExError(null)
    const res = await addWgerExercise(newExName.trim(), newExMuscle || null)
    if (res?.error) {
      setCreateExError(res.error)
      setIsCreatingEx(false)
      return
    }
    const newId = res.id!
    const newName = newExName.trim()
    // Add to local exercise list if it's truly new
    if (!res.existed) {
      setExerciseList(prev => [...prev, { id: newId, name: newName }].sort((a, b) => a.name.localeCompare(b.name)))
    }
    // Add to the program workout
    handleAddExercise(newExerciseModal.programWorkoutId, newId, newExerciseModal.currentCount)
    // Reset & close
    setNewExName('')
    setNewExMuscle('')
    setIsCreatingEx(false)
    setNewExerciseModal(null)
  }

  const handleWgerAdded = (item: WgerItem, id: string) => {
    if (!wgerModal) return
    // Add to local list (sorted) if not already there
    setExerciseList(prev =>
      prev.some(e => e.id === id)
        ? prev
        : [...prev, { id, name: item.name }].sort((a, b) => a.name.localeCompare(b.name))
    )
    // Slot into the program workout immediately
    handleAddExercise(wgerModal.programWorkoutId, id, wgerModal.currentCount)
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
                  onClick={e => { e.stopPropagation(); openShareModal(program.id, program.name, program.share_token) }}
                  className="p-2 transition-colors text-base"
                  title="Share program"
                >
                  {program.share_token ? '🔗' : <span className="text-gray-300 hover:text-gray-600">🔗</span>}
                </button>
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

      {/* SHARE MODAL */}
      {shareModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4 flex flex-col max-h-[85vh]">
          <div className="overflow-y-auto flex-1 p-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Share Program</h2>
                <p className="text-sm text-gray-400 mt-0.5">{shareModal.programName}</p>
              </div>
              <button
                onClick={() => { setShareModal(null); setShareCopied(false) }}
                className="text-gray-400 hover:text-gray-700 font-bold p-2"
              >✕</button>
            </div>

            {shareLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Generating link…</span>
              </div>
            ) : shareModal.token ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Anyone with this link can view the program structure and import it to their own account.
                </p>

                {/* Link display */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono text-gray-600 truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/programs/share/${shareModal.token}` : `/programs/share/${shareModal.token}`}
                  </div>
                  <button
                    onClick={() => handleCopyLink(shareModal.token!)}
                    className={`px-4 rounded-xl font-bold text-sm transition-colors flex-shrink-0 ${
                      shareCopied
                        ? 'bg-green-600 text-white'
                        : 'bg-black text-white hover:bg-gray-800'
                    }`}
                  >
                    {shareCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                <button
                  onClick={handleRevokeShare}
                  disabled={shareRevoking}
                  className="w-full text-xs font-semibold text-red-400 hover:text-red-600 transition-colors py-1 disabled:opacity-50"
                >
                  {shareRevoking ? 'Revoking…' : 'Revoke link'}
                </button>

                {/* Send to user */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Send to a user</p>

                  {dmSent ? (
                    <p className="text-sm font-semibold text-green-600">✓ Sent to {dmSent}!</p>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={dmQuery}
                          onChange={e => handleDmSearch(e.target.value)}
                          placeholder="Search by screen name…"
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                        />
                        {dmSearching && (
                          <div className="flex items-center px-2">
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          </div>
                        )}
                      </div>

                      {dmResults.length > 0 && !dmTarget && (
                        <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                          {dmResults.map(u => (
                            <button
                              key={u.user_id}
                              onClick={() => { setDmTarget(u); setDmResults([]) }}
                              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 border-b border-gray-100 last:border-0 transition-colors"
                            >
                              {u.screen_name?.trim() || `User ${u.user_id.slice(0, 6)}`}
                            </button>
                          ))}
                        </div>
                      )}
                      {dmQuery.trim() && !dmSearching && dmResults.length === 0 && !dmTarget && (
                        <p className="text-xs text-gray-400 px-1">No users found for "{dmQuery}"</p>
                      )}

                      {dmTarget && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                            <span className="text-sm font-bold text-blue-700">{dmTarget.screen_name}</span>
                            <button onClick={() => setDmTarget(null)} className="text-blue-400 hover:text-blue-600 ml-auto text-sm">✕</button>
                          </div>
                          <textarea
                            value={dmNote}
                            onChange={e => setDmNote(e.target.value)}
                            placeholder="Add a note (optional)…"
                            rows={2}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black resize-none"
                          />
                          <button
                            onClick={() => handleDmSend(shareModal!.programId)}
                            disabled={dmSending}
                            className="w-full bg-blue-600 text-white font-bold rounded-xl py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {dmSending ? 'Sending…' : `Send to ${dmTarget.screen_name}`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>{/* overflow-y-auto */}
          </div>{/* modal card */}
        </div>,
        document.body
      )}

      {/* NEW EXERCISE MODAL — portalled to body so it sits above all other modals */}
      {newExerciseModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">New Exercise</h2>
              <button
                onClick={() => { setNewExerciseModal(null); setNewExName(''); setNewExMuscle(''); setCreateExError(null) }}
                className="text-gray-400 hover:text-gray-700 font-bold p-2"
              >✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Exercise name</label>
                <input
                  type="text"
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateAndAddExercise() }}
                  placeholder="e.g., Bulgarian Split Squat"
                  autoFocus
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Muscle group (optional)</label>
                <select
                  value={newExMuscle}
                  onChange={e => setNewExMuscle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none text-sm"
                >
                  <option value="">— None —</option>
                  {MUSCLE_GROUPS.map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              {createExError && (
                <p className="text-sm text-red-500 font-medium">{createExError}</p>
              )}

              <button
                onClick={handleCreateAndAddExercise}
                disabled={isCreatingEx || !newExName.trim()}
                className="w-full bg-black text-white font-bold rounded-xl py-3 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {isCreatingEx ? 'Creating…' : 'Create & Add to Program'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* EXERCISE SETTINGS MODAL — portalled to body */}
      {(isLoadingExSettings || exSettingsModal) && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isLoadingExSettings ? 'Loading…' : exSettingsModal?.exercise.name}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Exercise settings</p>
              </div>
              <button
                onClick={() => { setExSettingsModal(null); setIsLoadingExSettings(false) }}
                className="text-gray-400 hover:text-gray-700 font-bold p-2 flex-shrink-0"
              >✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 pb-6">
              {isLoadingExSettings && (
                <div className="flex items-center justify-center py-16 gap-2">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  <span className="text-sm text-gray-400 font-medium">Loading settings…</span>
                </div>
              )}
              {!isLoadingExSettings && exSettingsModal && (
                <ExerciseSettingsCard
                  key={exSettingsModal.exercise.id}
                  exerciseId={exSettingsModal.exercise.id}
                  exerciseName={exSettingsModal.exercise.name}
                  muscleGroup={(exSettingsModal.exercise as any).muscle_group ?? null}
                  equipment={(exSettingsModal.exercise as any).equipment ?? null}
                  settings={exSettingsModal.settings as any}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* WGER BROWSE MODAL — portalled to body */}
      {wgerModal && typeof document !== 'undefined' && createPortal(
        <div style={{ zIndex: 9999, position: 'relative' }}>
          <WgerBrowseModal
            libraryNames={new Set(exerciseList.map(e => e.name.toLowerCase()))}
            onClose={() => setWgerModal(null)}
            onAdded={handleWgerAdded}
          />
        </div>,
        document.body
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
                  const availableExercises = exerciseList.filter(ex => !sortedExercises.some(pe => pe.exercise_id === ex.id))

                  return (
                    <div key={pw.id} className="space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{pw.name} — Exercises</p>

                      {sortedExercises.length === 0 && (
                        <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-xl">No exercises yet.</p>
                      )}

                      {sortedExercises.map(pe => (
                        <div key={pe.id} className={`flex justify-between items-center rounded-xl px-4 py-3 ${pe.superset_template_id ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                          <div
                            className={`flex-1 min-w-0 ${pe.exercise_id ? 'cursor-pointer' : ''}`}
                            onClick={() => pe.exercise_id && openExerciseSettings(pe.exercise_id)}
                          >
                            {pe.superset_template_id ? (
                              <>
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">🔄 Superset</p>
                                <p className="font-bold text-sm text-gray-900">{(pe as any).superset_templates?.name || 'Superset'}</p>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900">{pe.exercises?.name}</span>
                                {pe.exercise_id && (
                                  <span className="text-[10px] text-gray-400 font-medium">⚙️</span>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveExercise(pe.id)}
                            disabled={isPending}
                            className="text-gray-300 hover:text-red-500 font-bold text-lg transition-colors ml-3 flex-shrink-0"
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

                      {/* Create / browse new exercise */}
                      <div className="flex gap-3 pt-0.5">
                        <button
                          onClick={() => setNewExerciseModal({ programWorkoutId: pw.id, currentCount: sortedExercises.length })}
                          className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          ＋ Create new
                        </button>
                        <button
                          onClick={() => setWgerModal({ programWorkoutId: pw.id, currentCount: sortedExercises.length })}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-600 transition-colors"
                        >
                          🔍 Browse wger
                        </button>
                      </div>

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
