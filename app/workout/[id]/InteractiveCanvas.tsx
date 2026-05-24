'use client'

import { useState, useTransition } from 'react'
import CardioForm from '@/components/CardioForm'
import StrengthForm from '@/components/StrengthForm'
import SupersetForm from '@/components/SupersetForm'
import { deleteRunningLog, deleteStrengthLog } from '../actions'

type StrengthCard = {
  logId: string
  exerciseId: string
  name: string
  setsCount: number
  maxWeight: number
  repsArray: number[]
  rawSets: { weight: number, reps: number }[]
  supersetId?: string | null
  createdAt?: string // NEW: Preserves ordering when editing
}

export function InteractiveCanvas({ 
  workoutId, 
  initialRunningLogs = [],
  initialStrengthLogs = [],
  exercises = []
}: { 
  workoutId: string, 
  initialRunningLogs: any[],
  initialStrengthLogs: any[],
  exercises: any[]
}) {
  const [activeModule, setActiveModule] = useState<'none' | 'cardio' | 'strength' | 'superset' | 'program'>('none')
  const [editData, setEditData] = useState<any>(null)
  const [isPending, startTransition] = useTransition()

  // Map the logs directly and securely extract all raw data for editing
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
        createdAt: log.created_at // EXTRACTED TIMESTAMP
      }
    })

  const isCanvasEmpty = initialRunningLogs.length === 0 && strengthCards.length === 0

  // --- HANDLERS ---
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

  const closeForm = () => {
    setActiveModule('none')
    setEditData(null)
  }

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* 1. RENDER COMPLETED CARDIO */}
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

      {/* 2. RENDER COMPLETED LIFTS */}
      {strengthCards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-6">Completed Lifts</h3>
          {strengthCards.map((lift) => {
            
            // THE INLINE EDITOR: Render form here if this specific lift is being edited
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

            // Otherwise, render standard card
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
                   <p className="font-bold text-gray-900 text-[15px]">
                     {lift.name} 
                     {lift.supersetId && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Superset</span>}
                   </p>
                   <p className="font-bold text-gray-900">
                     {lift.maxWeight} <span className="text-xs font-normal text-gray-500">kg</span>
                   </p>
                 </div>
                 <p className="text-sm text-gray-500 font-medium">
                   {lift.setsCount} sets • {lift.repsArray.join('-')} reps
                 </p>
               </div>
            )
          })}
        </div>
      )}

      {/* 3. SHOW BUTTONS IF NO FORM IS OPEN */}
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
              disabled
              className="bg-gray-50 border border-gray-200 text-gray-400 font-bold py-5 rounded-2xl flex flex-col items-center gap-2 opacity-70 cursor-not-allowed"
            >
              <span className="text-2xl">📅</span>
              <span className="text-xs uppercase tracking-wider">Program</span>
            </button>
          </div>
        </>
      )}

      {/* 4. ACTIVE FORMS (Creation Only) */}
      {activeModule === 'cardio' && (
         <CardioForm workoutId={workoutId} onCancel={closeForm} editData={editData} />
      )}
      
      {/* THIS IS THE FIX: Only render at the bottom if we are NOT editing */}
      {activeModule === 'strength' && !editData && (
         <StrengthForm workoutId={workoutId} exercises={exercises} onCancel={closeForm} />
      )}

      {activeModule === 'superset' && (
         <SupersetForm workoutId={workoutId} exercises={exercises} onCancel={closeForm} />
      )}
    </div>
  )
}