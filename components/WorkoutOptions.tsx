'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { deleteWorkout, renameWorkout, saveWorkoutAsProgram } from '@/app/workout/actions'

export default function WorkoutOptions({
  workoutId,
  currentTitle,
}: {
  workoutId: string
  currentTitle: string
}) {
  const [open, setOpen]               = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [progName, setProgName]       = useState('')
  const [progDesc, setProgDesc]       = useState('')
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saveDone, setSaveDone]       = useState(false)
  const [isSaving, startSave]         = useTransition()
  const [isDeleting, setIsDeleting]   = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown on outside click — ref covers both button AND menu items
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleRename = async () => {
    setOpen(false)
    const newTitle = window.prompt('Enter new workout title:', currentTitle)
    if (newTitle && newTitle.trim() !== '' && newTitle !== currentTitle) {
      await renameWorkout(workoutId, newTitle.trim())
    }
  }

  const handleDelete = async () => {
    setOpen(false)
    if (!window.confirm('Delete this workout? This cannot be undone.')) return
    setIsDeleting(true)
    await deleteWorkout(workoutId)
  }

  const handleSaveAsProgram = () => {
    setOpen(false)
    setProgName(currentTitle)
    setProgDesc('')
    setSaveError(null)
    setSaveDone(false)
    setShowSaveModal(true)
  }

  const handleConfirmSave = () => {
    if (!progName.trim()) return
    setSaveError(null)
    startSave(async () => {
      const res = await saveWorkoutAsProgram(workoutId, progName, progDesc || null)
      if (res?.error) { setSaveError(res.error); return }
      setSaveDone(true)
      setTimeout(() => {
        setShowSaveModal(false)
        router.push('/programs')
      }, 1200)
    })
  }

  return (
    <>
      {/* ⋯ trigger */}
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setOpen(p => !p)}
          disabled={isDeleting}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 font-bold text-lg disabled:opacity-40"
        >
          ⋯
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
            <button
              onClick={handleRename}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors"
            >
              ✏️ Rename
            </button>
            <button
              onClick={handleSaveAsProgram}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors"
            >
              📋 Save as Program
            </button>
            <button
              onClick={handleDelete}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              🗑️ Delete Workout
            </button>
          </div>
        )}
      </div>

      {/* Save as Program modal */}
      {showSaveModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">Save as Program</h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-2"
              >✕</button>
            </div>

            {saveDone ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-bold text-gray-900">Program saved!</p>
                <p className="text-sm text-gray-400 mt-1">Redirecting to Programs…</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Program name
                  </label>
                  <input
                    type="text"
                    value={progName}
                    onChange={e => setProgName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmSave() }}
                    autoFocus
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-sm focus:ring-2 focus:ring-black outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Description <span className="font-normal normal-case text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={progDesc}
                    onChange={e => setProgDesc(e.target.value)}
                    placeholder="e.g. Upper body hypertrophy day"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-black outline-none"
                  />
                </div>

                <p className="text-xs text-gray-400">
                  All strength exercises from this workout will be added as a single-day program (Workout A). You can extend it to a multi-day split from the Programs page.
                </p>

                {saveError && <p className="text-sm text-red-500 font-medium">{saveError}</p>}

                <button
                  onClick={handleConfirmSave}
                  disabled={isSaving || !progName.trim()}
                  className="w-full bg-black text-white font-bold rounded-xl py-3.5 disabled:opacity-40 hover:bg-gray-800 active:scale-[0.98] transition-all"
                >
                  {isSaving ? 'Saving…' : 'Save Program'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
