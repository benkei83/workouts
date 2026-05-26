'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { saveWorkoutNotes } from '@/app/workout/actions'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function WorkoutNotes({
  workoutId,
  initialNotes,
}: {
  workoutId: string
  initialNotes: string | null
}) {
  const [value, setValue] = useState(initialNotes ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-resize the textarea to fit content
  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    resize()
  }, [value, resize])

  const persist = useCallback(async (notes: string) => {
    setSaveState('saving')
    const result = await saveWorkoutNotes(workoutId, notes)
    if (result?.error) {
      setSaveState('error')
    } else {
      setSaveState('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    }
  }, [workoutId])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => persist(e.target.value), 900)
  }

  // Flush immediately on blur so nothing is lost
  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    persist(value)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 pt-3 pb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</span>
        <span className={`text-[10px] font-semibold transition-opacity duration-300 ${
          saveState === 'saving' ? 'text-gray-400 opacity-100' :
          saveState === 'saved'  ? 'text-green-500 opacity-100' :
          saveState === 'error'  ? 'text-red-400 opacity-100'   : 'opacity-0'
        }`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Error'}
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Add notes about this session…"
        rows={1}
        className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-300 outline-none leading-relaxed"
      />
    </div>
  )
}
