'use client'

// In-memory store: survives SPA navigations (module stays loaded between routes).
// sessionStorage: survives router-cache evictions and hard reloads within the tab.
// Both are read synchronously in the useState initialiser — no effect timing races.
const _activeModuleStore: Record<string, 'strength' | 'cardio' | 'superset'> = {}
const SS_MODULE_KEY = (id: string) => `wkt-${id}-module`

import { useState, useTransition, useEffect, useLayoutEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// useLayoutEffect runs synchronously after DOM commit (before paint), so the stores
// are always written before the user can interact again. Falls back to useEffect on
// the server where layout effects are a no-op.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
import CardioForm from '@/components/CardioForm'
import StrengthForm from '@/components/StrengthForm'
import SupersetForm from '@/components/SupersetForm'
import ProgramGuide from '@/components/ProgramGuide'
import { deleteRunningLog, deleteStrengthLog, deleteSupersetGroup, createProgram, saveStrengthExercise, saveSupersetLog, finishWorkoutWithFeel } from '../actions'
import { enqueuePendingOp, dequeuePendingOp, getPendingOps, clearPendingOpsForWorkout, type PendingOp } from '@/lib/pendingQueue'
import DeloadBadge from '@/components/DeloadBadge'
import SuccessBadge from '@/components/SuccessBadge'
import MaintenanceBadge from '@/components/MaintenanceBadge'
import { getDeloadStatus, getSuccessStatus, getMaintenanceStatus } from '@/lib/deload'
import Link from 'next/link'
import WorkoutStatsPanel from '@/components/stats/WorkoutStatsPanel'
import WorkoutFeelEditor from '@/components/WorkoutFeelEditor'
import WorkoutNotes from '@/components/WorkoutNotes'
import type { UserSettings } from '@/lib/settings'
import { DEFAULT_USER_SETTINGS } from '@/lib/settings'

type StrengthCard = {
  logId: string
  exerciseId: string
  name: string
  setsCount: number
  maxWeight: number
  repsArray: number[]
  rawSets: { weight: number; reps: number; rpe?: number | null }[]
  notes?: string | null
  supersetId?: string | null
  createdAt?: string
  progression?: {
    result: 'increased' | 'deloaded' | 'success'
    oldWeight: number
    newWeight: number
    successes: number
    minSuccesses: number
    rate: number
  } | null
}

type RenderItem =
  | { type: 'solo'; card: StrengthCard }
  | { type: 'superset'; supersetId: string; cards: StrengthCard[] }

type ProgramExercise = { id: string; exercise_id: string; sort_order: number; exercises: { id: string; name: string } }
type ProgramWorkout = { id: string; name: string; rotation_order: number; program_exercises: ProgramExercise[] }
type Program = { id: string; name: string; description: string | null; program_workouts: ProgramWorkout[] }
type ActiveProgram = { program_id: string; current_rotation_index: number } | null

type ProgData = NonNullable<StrengthCard['progression']>

function ProgressionBadge({ prog }: { prog: ProgData | null }) {
  if (!prog) return null
  if (prog.result === 'increased') {
    const delta = Math.round((prog.newWeight - prog.oldWeight) * 100) / 100
    return (
      <div className="mt-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100">
        <span>🎉</span>
        <span>Progression unlocked — next session: <strong>{prog.newWeight}kg</strong> (+{delta}kg)</span>
      </div>
    )
  }
  if (prog.result === 'deloaded') {
    return (
      <div className="mt-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-100">
        <span>↓</span>
        <span>Deload scheduled — next session: <strong>{prog.newWeight}kg</strong></span>
      </div>
    )
  }
  if (prog.result === 'success' && prog.minSuccesses > 1 && prog.successes > 0) {
    return (
      <div className="mt-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-green-50 text-green-700 border border-green-100">
        <span>✓</span>
        <span>{prog.successes}/{prog.minSuccesses} sessions toward +{prog.rate}kg</span>
      </div>
    )
  }
  return null
}

type SupersetTemplate = {
  id: string
  name: string
  superset_template_exercises: {
    sort_order: number
    exercise_id: string
    exercises: { id: string; name: string }
  }[]
}

type PendingCard =
  | { pendingId: string; type: 'strength'; exerciseId: string; name: string; sets: { weight: number; reps: number; rpe?: number | null }[]; status: 'saving' | 'error'; errorMessage?: string }
  | { pendingId: string; type: 'superset'; matrix: Record<string, { weight: number; reps: number }[]>; names: Record<string, string>; status: 'saving' | 'error'; errorMessage?: string }

export function InteractiveCanvas({
  workoutId,
  initialRunningLogs = [],
  initialStrengthLogs = [],
  exercises = [],
  programs = [],
  activeProgram = null,
  supersetTemplates = [],
  isFinished = false,
  durationMins = 0,
  feelRating = null,
  intensity = null,
  notes = null,
  exerciseSettingsMap = {},
  historicalBests = {},
  userSettings = DEFAULT_USER_SETTINGS,
  focusExerciseId = null,
}: {
  workoutId: string
  initialRunningLogs: any[]
  initialStrengthLogs: any[]
  exercises: any[]
  programs: Program[]
  activeProgram: ActiveProgram
  supersetTemplates: SupersetTemplate[]
  isFinished?: boolean
  durationMins?: number
  feelRating?: number | null
  intensity?: string | null
  notes?: string | null
  exerciseSettingsMap?: Record<string, { target_reps?: number | null } | null>
  historicalBests?: Record<string, { best1rm: number; bestVolume: number }>
  userSettings?: UserSettings
  focusExerciseId?: string | null
}) {
  const [activeModule, setActiveModule] = useState<'none' | 'cardio' | 'strength' | 'superset' | 'program_select' | 'program_guide'>(() => {
    if (isFinished) return 'none'
    // Focus mode: always open strength form directly
    if (focusExerciseId) return 'strength'
    // 1. In-memory (fastest — same JS session)
    const mem = _activeModuleStore[workoutId]
    if (mem) return mem
    // sessionStorage fallback (survives router-cache evictions / hard reloads)
    try {
      const ss = sessionStorage.getItem(SS_MODULE_KEY(workoutId))
      if (ss === 'strength' || ss === 'cardio' || ss === 'superset') return ss
    } catch {}
    return 'none'
  })
  const [editData, setEditData] = useState<any>(null)
  const [editSupersetData, setEditSupersetData] = useState<StrengthCard[] | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [isCreatingProgram, setIsCreatingProgram] = useState(false)
  // Post-save settings overrides — keyed by exerciseId.
  // The progression engine updates DB but exercises is a prop; this keeps badges in sync.
  const [settingsOverrides, setSettingsOverrides] = useState<Record<string, any>>({})
  const router = useRouter()

  // ── Optimistic / offline state ────────────────────────────
  const [pendingCards, setPendingCards] = useState<PendingCard[]>([])
  const [staleOps, setStaleOps] = useState<PendingOp[]>([])
  const prevLogCount = useRef(initialStrengthLogs.length)

  // On mount: surface any ops that survived a crash / tab close
  useEffect(() => {
    const stale = getPendingOps().filter(op => op.workoutId === workoutId)
    if (stale.length > 0) setStaleOps(stale)
  }, [workoutId])

  // When server confirms new logs, clear all in-flight 'saving' pending cards
  useEffect(() => {
    const newCount = initialStrengthLogs.length
    if (newCount > prevLogCount.current) {
      setPendingCards(prev => prev.filter(c => c.status === 'error'))
    }
    prevLogCount.current = newCount
  }, [initialStrengthLogs.length])

  // ── Screen wake lock ──────────────────────────────────────────────────────
  // Keeps the screen on while a workout is active. The lock is automatically
  // released by the browser when the page is hidden (e.g. user switches apps),
  // so we re-request it on visibility change.
  useEffect(() => {
    if (isFinished) return
    if (!('wakeLock' in navigator)) return

    let sentinel: { release: () => Promise<void> } | null = null

    const acquire = async () => {
      try {
        sentinel = await (navigator as any).wakeLock.request('screen')
      } catch {
        // Silently ignore — e.g. battery saver mode, low power state
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      sentinel?.release().catch(() => {})
    }
  }, [isFinished])

  const handleSaveStrength = async (
    exerciseId: string,
    exerciseName: string,
    sets: { weight: number; reps: number; rpe?: number | null }[],
    skipProgression: boolean = false,
    notes?: string | null,
  ) => {
    const pendingId = crypto.randomUUID()

    enqueuePendingOp({ id: pendingId, workoutId, type: 'strength', exerciseId, sets, timestamp: Date.now() })
    setPendingCards(prev => [...prev, { pendingId, type: 'strength', exerciseId, name: exerciseName, sets, status: 'saving' }])

    const result = await saveStrengthExercise(workoutId, exerciseId, sets, { skipProgression, notes })
    if (result?.error) {
      setPendingCards(prev => prev.map(c => c.pendingId === pendingId ? { ...c, status: 'error', errorMessage: result.error } : c))
    } else {
      dequeuePendingOp(pendingId)
      // Patch local state immediately so badges update before the refresh arrives
      if (result?.newSettings) {
        setSettingsOverrides(prev => ({ ...prev, [exerciseId]: result.newSettings }))
      }
      // Explicitly pull fresh RSC data. Avoids the "Recoverable hydration error" that
      // occurs when revalidatePath pushes an RSC delta (updated streak count) against
      // old client HTML — a client-initiated pull reconciles cleanly, a server push does not.
      if (!focusExerciseId) startTransition(() => router.refresh())
      // pending card removed by the useEffect above when new log arrives

      // Focus mode: auto-finish the workout after saving the exercise
      if (focusExerciseId) {
        await new Promise(r => setTimeout(r, 800)) // brief pause so the user sees their sets logged
        await finishWorkoutWithFeel(workoutId, null, null)
        window.dispatchEvent(new CustomEvent(`workout-finished:${workoutId}`))
        router.push('/')
      }
    }
  }

  const handleSaveSuperset = async (
    matrix: Record<string, { weight: number; reps: number }[]>,
    names: Record<string, string>
  ) => {
    const pendingId = crypto.randomUUID()

    enqueuePendingOp({ id: pendingId, workoutId, type: 'superset', matrix, timestamp: Date.now() })
    setPendingCards(prev => [...prev, { pendingId, type: 'superset', matrix, names, status: 'saving' }])

    const result = await saveSupersetLog(workoutId, matrix)
    if (result && 'error' in result) {
      setPendingCards(prev => prev.map(c => c.pendingId === pendingId ? { ...c, status: 'error', errorMessage: (result as any).error } : c))
    } else {
      dequeuePendingOp(pendingId)
    }
  }

  const retryPendingCard = async (card: PendingCard) => {
    setPendingCards(prev => prev.map(c => c.pendingId === card.pendingId ? { ...c, status: 'saving', errorMessage: undefined } : c))
    if (card.type === 'strength') {
      const result = await saveStrengthExercise(workoutId, card.exerciseId, card.sets)
      if (result?.error) {
        setPendingCards(prev => prev.map(c => c.pendingId === card.pendingId ? { ...c, status: 'error', errorMessage: result.error } : c))
      } else {
        dequeuePendingOp(card.pendingId)
      }
    } else {
      const result = await saveSupersetLog(workoutId, card.matrix)
      if (result && 'error' in result) {
        setPendingCards(prev => prev.map(c => c.pendingId === card.pendingId ? { ...c, status: 'error', errorMessage: (result as any).error } : c))
      } else {
        dequeuePendingOp(card.pendingId)
      }
    }
  }

  const dismissPendingCard = (pendingId: string) => {
    dequeuePendingOp(pendingId)
    setPendingCards(prev => prev.filter(c => c.pendingId !== pendingId))
  }

  const syncStaleOps = async () => {
    for (const op of staleOps) {
      if (op.type === 'strength' && op.exerciseId && op.sets) {
        await saveStrengthExercise(op.workoutId, op.exerciseId, op.sets)
      } else if (op.type === 'superset' && op.matrix) {
        await saveSupersetLog(op.workoutId, op.matrix)
      }
      dequeuePendingOp(op.id)
    }
    setStaleOps([])
  }

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
        rawSets: sets.map((s: any) => ({ weight: s.actual_weight, reps: s.actual_reps, rpe: s.rpe ?? null })),
        notes: (log as any).notes ?? null,
        supersetId: log.superset_id || null,
        createdAt: log.created_at,
        progression: log.prog_result ? {
          result:      (log.prog_result as string) as ('increased' | 'deloaded' | 'success'),
          oldWeight:   Number(log.prog_old_weight) || 0,
          newWeight:   Number(log.prog_new_weight) || 0,
          successes:   Number(log.prog_successes)  || 0,
          minSuccesses:Number(log.prog_min_successes) || 1,
          rate:        Number(log.prog_rate) || 2.5,
        } : null,
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

  const isCanvasEmpty = initialRunningLogs.length === 0 && strengthCards.length === 0 && pendingCards.length === 0

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

  // Keep both stores in sync after every activeModule change
  useIsomorphicLayoutEffect(() => {
    if (isFinished) return
    const key = SS_MODULE_KEY(workoutId)
    if (activeModule === 'strength' || activeModule === 'cardio' || activeModule === 'superset') {
      _activeModuleStore[workoutId] = activeModule
      try { sessionStorage.setItem(key, activeModule) } catch {}
    } else {
      delete _activeModuleStore[workoutId]
      try { sessionStorage.removeItem(key) } catch {}
    }
  }, [activeModule, workoutId, isFinished])

  const closeForm = () => {
    delete _activeModuleStore[workoutId]
    try { sessionStorage.removeItem(SS_MODULE_KEY(workoutId)) } catch {}
    setActiveModule('none')
    setEditData(null)
    setEditSupersetData(null)
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

      {/* 0a. FEEL EDITOR (finished workouts) */}
      {isFinished && (
        <WorkoutFeelEditor
          workoutId={workoutId}
          initialFeelRating={feelRating}
          initialIntensity={intensity}
        />
      )}

      {/* 0b. NOTES — always visible, auto-saves on change */}
      <WorkoutNotes workoutId={workoutId} initialNotes={notes} />

      {/* 0d. STALE-OP RECOVERY BANNER */}
      {staleOps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-amber-700">
            ⚠️ {staleOps.length} unsaved {staleOps.length === 1 ? 'log' : 'logs'} from your last session
          </p>
          <div className="flex gap-3 flex-shrink-0">
            <button onClick={syncStaleOps} className="text-xs font-bold text-amber-700 underline">Sync now</button>
            <button onClick={() => { clearPendingOpsForWorkout(workoutId); setStaleOps([]) }} className="text-xs font-bold text-gray-400">Dismiss</button>
          </div>
        </div>
      )}

      {/* 1. COMPLETED CARDIO */}
      {initialRunningLogs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Completed Cardio</h3>
          {initialRunningLogs.map((log) => {
            if (activeModule === 'cardio' && editData?.id === log.id) {
              return <CardioForm key={log.id} workoutId={workoutId} onCancel={closeForm} editData={editData} />
            }
            const durSecs = log.duration_seconds % 60
            const durMins = Math.floor(log.duration_seconds / 60)
            const durationStr = durSecs === 0
              ? `${durMins} min`
              : `${durMins}:${String(durSecs).padStart(2, '0')}`
            return (
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
                    {durationStr}
                    {log.average_incline ? ` @ ${log.average_incline}% inc` : ''}
                  </p>
                </div>
                <div className="text-right pr-2">
                  <p className="font-bold text-gray-900">{log.distance_km} <span className="text-xs font-normal text-gray-500">km</span></p>
                  <p className="text-sm text-gray-500">{log.average_speed} <span className="text-xs">km/h</span></p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 2. COMPLETED LIFTS + PENDING */}
      {(renderItems.length > 0 || pendingCards.length > 0) && (
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
                    userSettings={userSettings}
                  />
                )
              }
              const exData = exercises.find((e: any) => e.id === lift.exerciseId) as any
              const streak = exData?.computedStreak
              // Use post-save override if available so badges reflect the progression result
              const exSettings = settingsOverrides[lift.exerciseId]
                ? { ...exData?.settings, ...settingsOverrides[lift.exerciseId] }
                : exData?.settings
              // Suppress streak badges if the log already has a progression result stored —
              // ProgressionBadge is more accurate and we don't want duplicates.
              const hasProg = !!lift.progression
              const ds = isFinished || hasProg ? null : getDeloadStatus(exSettings, streak)
              const ss = isFinished || hasProg ? null : getSuccessStatus(exSettings, streak)
              const ms = isFinished || hasProg ? null : getMaintenanceStatus(exSettings, streak)
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
                  {lift.notes && (
                    <p className="text-xs text-gray-400 italic mt-0.5 leading-snug">{lift.notes}</p>
                  )}
                  {ss && <SuccessBadge status={ss} />}
                  {ms && <MaintenanceBadge status={ms} />}
                  {ds && <DeloadBadge status={ds} />}
                  {/* Progression result — stored on the log, works in both active and finished workouts */}
                  <ProgressionBadge prog={lift.progression ?? null} />
                </div>
              )
            }

            // ── Superset group ──
            const isEditingThisSuperset =
              activeModule === 'superset' &&
              editSupersetData !== null &&
              editSupersetData[0]?.supersetId === item.supersetId

            if (isEditingThisSuperset) {
              return (
                <SupersetForm
                  key={item.supersetId}
                  workoutId={workoutId}
                  exercises={exercises}
                  supersetTemplates={supersetTemplates}
                  editData={editSupersetData!}
                  onCancel={closeForm}
                  userSettings={userSettings}
                />
              )
            }

            return (
              <div key={item.supersetId} className="border-2 border-blue-200 rounded-2xl overflow-hidden">
                {/* Group header */}
                <div className="bg-blue-50 px-4 py-2 flex justify-between items-center border-b border-blue-100">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">🔄 Superset</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditSupersetData(item.cards); setActiveModule('superset') }}
                      className="text-gray-400 hover:text-blue-500 font-bold text-xs transition-colors"
                    >✏️</button>
                    <button
                      onClick={() => handleDeleteSupersetGroup(item.supersetId)}
                      className="text-gray-300 hover:text-red-500 font-bold text-sm transition-colors leading-none"
                    >✕</button>
                  </div>
                </div>
                {/* Individual exercises inside the group */}
                <div className="bg-white divide-y divide-blue-50">
                  {item.cards.map((lift, liftIdx) => {
                    const exData = exercises.find((e: any) => e.id === lift.exerciseId) as any
                    const streak = exData?.computedStreak
                    const exSettings = exData?.settings
                    const ds = getDeloadStatus(exSettings, streak)
                    const ss = getSuccessStatus(exSettings, streak)
                    const ms = getMaintenanceStatus(exSettings, streak)
                    return (
                      <div key={lift.logId} className="px-4 py-3 flex justify-between items-start">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-400 w-4">{String.fromCharCode(65 + liftIdx)}</span>
                            {lift.name}
                          </p>
                          <p className="text-xs text-gray-500 font-medium ml-6">
                            {lift.setsCount} sets • {lift.repsArray.join('-')} reps
                          </p>
                          <div className="ml-6">
                            {ss && <SuccessBadge status={ss} compact />}
                            {ms && <MaintenanceBadge status={ms} compact />}
                            {ds && <DeloadBadge status={ds} compact />}
                          </div>
                        </div>
                        <p className="font-bold text-gray-900 text-sm shrink-0">
                          {lift.maxWeight} <span className="text-xs font-normal text-gray-500">kg</span>
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* ── Pending (optimistic) cards ── */}
          {pendingCards.map(card => {
            const isSaving = card.status === 'saving'
            const isError = card.status === 'error'

            if (card.type === 'strength') {
              const maxW = Math.max(...card.sets.map(s => s.weight))
              return (
                <div key={card.pendingId} className={`px-4 py-4 rounded-xl border flex flex-col gap-1 relative transition-all ${isSaving ? 'bg-white border-blue-200 animate-pulse' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex justify-between items-center pr-2">
                    <p className="font-bold text-gray-900 text-[15px]">{card.name}</p>
                    <p className="font-bold text-gray-900">{maxW} <span className="text-xs font-normal text-gray-500">kg</span></p>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">{card.sets.length} sets • {card.sets.map(s => s.reps).join('-')} reps</p>
                  {isSaving && <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Saving…</p>}
                  {isError && (
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-red-500 font-semibold flex-1">Failed to save — {card.errorMessage || 'network error'}</p>
                      <button onClick={() => retryPendingCard(card)} className="text-xs font-bold text-blue-600 underline">Retry</button>
                      <button onClick={() => dismissPendingCard(card.pendingId)} className="text-xs font-bold text-gray-400">Discard</button>
                    </div>
                  )}
                </div>
              )
            }

            // superset pending card
            const exerciseIds = Object.keys(card.matrix)
            return (
              <div key={card.pendingId} className={`border-2 rounded-2xl overflow-hidden transition-all ${isSaving ? 'border-blue-200 animate-pulse' : 'border-red-200'}`}>
                <div className={`px-4 py-2 flex justify-between items-center border-b ${isSaving ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">🔄 Superset</span>
                  {isSaving && <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Saving…</span>}
                  {isError && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => retryPendingCard(card)} className="text-xs font-bold text-blue-600 underline">Retry</button>
                      <button onClick={() => dismissPendingCard(card.pendingId)} className="text-xs font-bold text-gray-400">Discard</button>
                    </div>
                  )}
                </div>
                <div className="bg-white divide-y divide-blue-50">
                  {exerciseIds.map((exId, i) => {
                    const sets = card.matrix[exId]
                    const maxW = Math.max(...sets.map(s => s.weight))
                    return (
                      <div key={exId} className="px-4 py-3 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-400 w-4">{String.fromCharCode(65 + i)}</span>
                            {card.names[exId] || 'Exercise'}
                          </p>
                          <p className="text-xs text-gray-500 font-medium ml-6">{sets.length} sets • {sets.map(s => s.reps).join('-')} reps</p>
                        </div>
                        <p className="font-bold text-gray-900 text-sm">{maxW} <span className="text-xs font-normal text-gray-500">kg</span></p>
                      </div>
                    )
                  })}
                </div>
                {isError && <p className="text-xs text-red-500 font-semibold px-4 py-2 bg-red-50">Failed — {card.errorMessage || 'network error'}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* 2b. WORKOUT STATS (finished workouts only) */}
      {isFinished && (
        <WorkoutStatsPanel
          strengthLogs={initialStrengthLogs}
          runningLogs={initialRunningLogs}
          exercises={exercises}
          durationMins={durationMins}
          exerciseSettingsMap={exerciseSettingsMap}
          historicalBests={historicalBests}
        />
      )}

      {/* 2c. TROPHIES LINK (finished workouts only) */}
      {isFinished && (
        <Link
          href="/trophies"
          className="flex items-center justify-between bg-white rounded-xl border border-yellow-200 shadow-sm px-4 py-3 hover:border-yellow-400 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-sm font-bold text-gray-900">Your Trophies</p>
              <p className="text-xs text-gray-400 font-medium">See all achievements you've unlocked</p>
            </div>
          </div>
          <span className="text-gray-400 group-hover:text-gray-600 font-bold transition-colors">→</span>
        </Link>
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
      {activeModule === 'cardio' && !editData && (
        <CardioForm workoutId={workoutId} onCancel={closeForm} />
      )}

      {activeModule === 'strength' && !editData && (
        <StrengthForm
          workoutId={workoutId}
          exercises={exercises}
          onCancel={closeForm}
          onSave={handleSaveStrength}
          userSettings={userSettings}
          initialSets={userSettings.default_sets ?? 5}
          initialExerciseId={focusExerciseId ?? undefined}
        />
      )}

      {activeModule === 'superset' && !editSupersetData && (
        <SupersetForm
          workoutId={workoutId}
          exercises={exercises}
          supersetTemplates={supersetTemplates}
          onCancel={closeForm}
          onSave={handleSaveSuperset}
          userSettings={userSettings}
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
