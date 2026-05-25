'use client'

import { useState, useTransition } from 'react'
import CardioForm from '@/components/CardioForm'
import StrengthForm from '@/components/StrengthForm'
import SupersetForm from '@/components/SupersetForm'
import ProgramGuide from '@/components/ProgramGuide'
import { deleteRunningLog, deleteStrengthLog, deleteSupersetGroup, createProgram } from '../actions'
import Link from 'next/link'

type StrengthCard = {
  logId: string
  exerciseId: string
  name: string
  setsCount: number
  maxWeight: number
  repsArray: number[]
  rawSets: { weight: number, reps: number }[]
  supersetId?: string | null
  createdAt?: string
}

type RenderItem =
  | { type: 'solo'; card: StrengthCard }
  | { type: 'superset'; supersetId: string; cards: StrengthCard[] }

type ProgramExercise = { id: string; exercise_id: string; sort_order: number; exercises: { id: string; name: string } }
type ProgramWorkout = { id: string; name: string; rotation_order: number; program_exercises: ProgramExercise[] }
type Program = { id: string; name: string; description: string | null; program_workouts: ProgramWorkout[] }
type ActiveProgram = { program_id: string; current_rotation_index: number } | null

type SupersetTemplate = {
  id: string
  name: string
  superset_template_exercises: {
    sort_order: number
    exercise_id: string
    exercises: { id: string; name: string }
  }[]
}

export function InteractiveCanvas({
  workoutId,
  initialRunningLogs = [],
  initialStrengthLogs = [],
  exercises = [],
  programs = [],
  activeProgram = null,
  supersetTemplates = [],
}: {
  workoutId: string
  initialRunningLogs: any[]
  initialStrengthLogs: any[]
  exercises: any[]
  programs: Program[]
  activeProgram: ActiveProgram
  supersetTemplates: SupersetTemplate[]
}) {
  const [activeModule, setActiveModule] = useState<'none' | 'cardio' | 'strength' | 'superset' | 'program_select' | 'program_guide'>('none')
  const [editData, setEditData] = useState<any>(null)
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [isCreatingProgram, setIsCreatingProgram] = useState(false)

  const strengthCards: StrengthCard[] = initialStrengthLogs
    .filter(log => log.strength_sets && log.strength_sets.length > 0)
    .map(log => {
      const sets = log.strength_sets
      const name = sets[0].exercises?.name || 'Unknown Exercise'
      const maxWeight = Math.max(...sets.map((s: any) => s.actual_weight))
      return {
        logId: log.id,
        exerciseId: sets[0].exercise_id,
        name,
        setsCount: sets.length,
        maxWeight,
        repsArray: sets.map((s: any) => s.actual_reps),
        rawSets: sets.map((s: any) => ({ weight: s.actual_weight, reps: s.actual_reps })),
        supersetId: log.superset_id || null,
        createdAt: log.created_at,
      }
    })

  // Build render items — group by supersetId
  const renderItems: RenderItem[] = []
  const supersetGroupMap = new Map<string, StrengthCard[]>()
  const seenSupersetIds = new Set<string>()

  for (const card of strengthCards) {
    if (card.supersetId) {
      const group = supersetGroupMap.get(card.supersetId) || []
      group.push(card)
      supersetGroupMap.set(card.supersetId, group)
    }
  }
  for (const card of strengthCards) {
    if (!card.supersetId) {
      renderItems.push({ type: 'solo', card })
    } else if (!seenSupersetIds.has(card.supersetId)) {
      seenSupersetIds.add(card.supersetId)
      renderItems.push({
        type: 'superset',
        supersetId: card.supersetId,
        cards: supersetGroupMap.get(card.supersetId)!,
      })
    }
  }

  const isCanvasEmpty = initialRunningLogs.length === 0 && strengthCards.length === 0

  const handleDeleteCardio = (logId: string) => {
    if (window.confirm('Delete this cardio session?')) {
      startTransition(() => { deleteRunningLog(logId, workoutId) })
    }
  }

  const handleDeleteStrength = (logId: string) => {
    if (window.confirm('Delete this exercise?')) {
      startTransition(() => { deleteStrengthLog(logId, workoutId) })
    }
  }

  const handleDeleteSupersetGroup = (supersetId: string) => {
    if (window.confirm('Delete this entire superset?')) {
      startTransition(() => { deleteSupersetGroup(supersetId, workoutId) })
    }
  }

  const closeForm = () => {
    setActiveModule('none')
    setEditData(null)
    setSelectedProgram(null)
    setIsCreatingProgram(false)
  }

  const startProgram = (program: Program) => {
    const totalDays = program.program_workouts?.length || 1
    let dayIndex = 0
    if (activeProgram?.program_id === program.id) {
      dayIndex = activeProgram.current_rotation_index % totalDays
    }
    setSelectedProgram(program)
    setSelectedDayIndex(dayIndex)
    setActiveModule('program_guide')
  }

  const handleCreateProgram = (formData: FormData) => {
    startTransition(async () => {
      const res = await createProgram(formData)
      if (res?.success) {
        window.location.reload()
      }
      setIsCreatingProgram(false)
    })
  }

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>

      {/* 1. COMPLETED CARDIO */}
      {initialRunningLogs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Completed Cardio</h3>
          {initialRunningLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center relative group">
              <div className="absolute -top-2 -right-2 flex gap-1 z-10">
                <button
                  onClick={() => { setEditData(log); setActiveModule('cardio') }}
                  className="bg-white border border-gray-200 text-gray-400 hover:text-blue-500 w-7 h-7 flex items-center justify-center rounded-full shadow-sm text-[10px] transition-colors"
                >✏️</button>
                <button
                  onClick={() => handleDeleteCardio(log.id)}
                  className="bg-white border border-gray-200 text-gray-300 hover:text-red-500 w-7 h-7 flex items-center justify-center rounded-full shadow-sm text-xs font-bold transition-colors"
                >✕</button>
              </div>
              <div>
                <p className="font-bold text-gray-900 capitalize flex items-center gap-2">
                  🏃 {log.environment} {log.session_type}
                </p>
                <p className="text-sm text-gray-500">
                  {Math.round(log.duration_seconds / 60)} mins
                  {log.average_incline ? ` @ ${log.average_incline}% inc` : ''}
                </p>
              </div>
              <div className="text-right pr-2">
                <p className="font-bold text-gray-900">{log.distance_km} <span className="text-xs font-normal text-gray-500">km</span></p>
                <p className="text-sm text-gray-500">{log.average_speed} <span className="text-xs">km/h</span></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. COMPLETED LIFTS */}
      {renderItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-6">Completed Lifts</h3>

          {renderItems.map((item, idx) => {
            // ── Single exercise ──
            if (item.type === 'solo') {
              const lift = item.card
              if (activeModule === 'strength' && editData?.logId === lift.logId) {
                return (
                  <StrengthForm
                    key={lift.logId}
                    workoutId={workoutId}
                    exercises={exercises}
                    onCancel={closeForm}
                    editData={editData}
                  />
                )
              }
              return (
                <div key={lift.logId} className="bg-white px-4 py-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1 relative group">
                  <div className="absolute -top-2 -right-2 flex gap-1 z-10">
                    <button
                      onClick={() => { setEditData(lift); setActiveModule('strength') }}
                      className="bg-white border border-gray-200 text-gray-400 hover:text-blue-500 w-7 h-7 flex items-center justify-center rounded-full shadow-sm text-[10px] transition-colors"
                    >✏️</button>
                    <button
                      onClick={() => handleDeleteStrength(lift.logId)}
                      className="bg-white border border-gray-200 text-gray-300 hover:text-red-500 w-7 h-7 flex items-center justify-center rounded-full shadow-sm text-xs font-bold transition-colors"
                    >✕</button>
                  </div>
                  <div className="flex justify-between items-center pr-4">
                    <p className="font-bold text-gray-900 text-[15px]">{lift.name}</p>
                    <p className="font-bold text-gray-900">
                      {lift.maxWeight} <span className="text-xs font-normal text-gray-500">kg</span>
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    {lift.setsCount} sets • {lift.repsArray.join('-')} reps
                  </p>
                </div>
              )
            }

            // ── Superset group ──
            return (
              <div key={item.supersetId} className="border-2 border-blue-200 rounded-2xl overflow-hidden">
                {/* Group header */}
                <div className="bg-blue-50 px-4 py-2 flex justify-between items-center border-b border-blue-100">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">🔄 Superset</span>
                  <button
                    onClick={() => handleDeleteSupersetGroup(item.supersetId)}
                    className="text-gray-300 hover:text-red-500 font-bold text-sm transition-colors leading-none"
                  >✕</button>
                </div>
                {/* Individual exercises inside the group */}
                <div className="bg-white divide-y divide-blue-50">
                  {item.cards.map((lift, liftIdx) => (
                    <div key={lift.logId} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <span className="text-xs font-bold text-blue-400 w-4">{String.fromCharCode(65 + liftIdx)}</span>
                          {lift.name}
                        </p>
                        <p className="text-xs text-gray-500 font-medium ml-6">
                          {lift.setsCount} sets • {lift.repsArray.join('-')} reps
                        </p>
                      </div>
                      <p className="font-bold text-gray-900 text-sm">
                        {lift.maxWeight} <span className="text-xs font-normal text-gray-500">kg</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. MODULE BUTTONS */}
      {activeModule === 'none' && (
        <>
          {isCanvasEmpty && (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50/50 mt-6">
              <p className="text-gray-400 font-medium text-sm">Your canvas is empty.</p>
              <p className="text-gray-400 text-xs mt-1">Select a module below to start training.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={() => setActiveModule('cardio')}
              className="bg-white border border-gray-200 text-gray-900 font-bold py-5 rounded-2xl shadow-sm hover:border-black hover:shadow-md transition-all flex flex-col items-center gap-2 active:scale-95"
            >
              <span className="text-2xl">🏃</span>
              <span className="text-xs uppercase tracking-wider">Cardio</span>
            </button>

            <button
              onClick={() => setActiveModule('strength')}
              className="bg-white border border-gray-200 text-gray-900 font-bold py-5 rounded-2xl shadow-sm hover:border-black hover:shadow-md transition-all flex flex-col items-center gap-2 active:scale-95"
            >
              <span className="text-2xl">🏋️</span>
              <span className="text-xs uppercase tracking-wider">Strength</span>
            </button>

            <button
              onClick={() => setActiveModule('superset')}
              className="bg-white border border-gray-200 text-gray-900 font-bold py-5 rounded-2xl shadow-sm hover:border-blue-500 hover:shadow-md transition-all flex flex-col items-center gap-2 active:scale-95"
            >
              <span className="text-2xl">🔄</span>
              <span className="text-xs uppercase tracking-wider">Superset</span>
            </button>

            <button
              onClick={() => setActiveModule('program_select')}
              className="bg-white border border-gray-200 text-gray-900 font-bold py-5 rounded-2xl shadow-sm hover:border-purple-500 hover:shadow-md transition-all flex flex-col items-center gap-2 active:scale-95"
            >
              <span className="text-2xl">📅</span>
              <span className="text-xs uppercase tracking-wider">Program</span>
            </button>
          </div>
        </>
      )}

      {/* 4. ACTIVE FORMS */}
      {activeModule === 'cardio' && (
        <CardioForm workoutId={workoutId} onCancel={closeForm} editData={editData} />
      )}

      {activeModule === 'strength' && !editData && (
        <StrengthForm workoutId={workoutId} exercises={exercises} onCancel={closeForm} />
      )}

      {activeModule === 'superset' && (
        <SupersetForm
          workoutId={workoutId}
          exercises={exercises}
          supersetTemplates={supersetTemplates}
          onCancel={closeForm}
        />
      )}

      {/* 5. PROGRAM SELECTOR */}
      {activeModule === 'program_select' && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-bold text-gray-900">📅 Start with Program</h2>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
          </div>

          {programs.length === 0 && !isCreatingProgram ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-gray-500 text-sm">No programs yet.</p>
              <button
                onClick={() => setIsCreatingProgram(true)}
                className="bg-black text-white font-bold rounded-xl py-3 px-6 active:scale-95 transition-all"
              >
                Create Your First Program
              </button>
              <div className="pt-2">
                <Link href="/programs" className="text-sm text-gray-400 hover:text-gray-700 font-semibold">
                  Or manage programs →
                </Link>
              </div>
            </div>
          ) : !isCreatingProgram ? (
            <div className="space-y-3">
              {programs.map(program => {
                const totalDays = program.program_workouts?.length || 1
                let dayIndex = 0
                if (activeProgram?.program_id === program.id) {
                  dayIndex = activeProgram.current_rotation_index % totalDays
                }
                const days = [...(program.program_workouts || [])].sort((a, b) => a.rotation_order - b.rotation_order)
                const nextDay = days[dayIndex]

                return (
                  <button
                    key={program.id}
                    onClick={() => startProgram(program)}
                    className="w-full text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-xl p-4 transition-all active:scale-[0.99] group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-black">{program.name}</p>
                        {program.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{program.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1.5">
                          {totalDays}-day split
                          {nextDay ? ` • Today: ${nextDay.name}` : ''}
                        </p>
                      </div>
                      <span className="text-gray-400 group-hover:text-black font-bold">→</span>
                    </div>
                  </button>
                )
              })}

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setIsCreatingProgram(true)}
                  className="text-sm text-gray-500 hover:text-black font-semibold transition-colors"
                >
                  + New Program
                </button>
                <Link href="/programs" className="text-sm text-gray-400 hover:text-gray-700 font-semibold">
                  Manage programs →
                </Link>
              </div>
            </div>
          ) : (
            <form action={handleCreateProgram} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Program Name</label>
                <input
                  type="text" name="name" required autoFocus
                  placeholder="e.g., Push / Pull / Legs"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Split Type</label>
                <select name="split" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-black outline-none">
                  <option value="1">1-day (same every session)</option>
                  <option value="2">2-day split (A / B)</option>
                  <option value="3">3-day split (A / B / C)</option>
                </select>
              </div>
              <p className="text-xs text-gray-400">You can add exercises to this program in the Programs screen.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingProgram(false)}
                  className="flex-1 bg-gray-100 text-gray-700 font-bold rounded-xl py-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-black text-white font-bold rounded-xl py-3 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 6. PROGRAM GUIDED MODE */}
      {activeModule === 'program_guide' && selectedProgram && (
        <ProgramGuide
          workoutId={workoutId}
          program={selectedProgram}
          dayIndex={selectedDayIndex}
          exercises={exercises}
          onComplete={closeForm}
        />
      )}
    </div>
  )
}
