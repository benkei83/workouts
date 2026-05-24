'use client'

import { useState } from 'react'
import CardioForm from '@/components/CardioForm'
import StrengthForm from '@/components/StrengthForm'

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
  const [activeModule, setActiveModule] = useState<'none' | 'cardio' | 'strength'>('none')

  // Safely flatten the sets array, defaulting to empty if null
  const completedExercises = initialStrengthLogs.flatMap(log => log.strength_sets || [])
  
  // Group the sets by exercise name for a cleaner summary card
  const groupedLifts = completedExercises.reduce((acc, set) => {
    const name = set.exercises?.name || 'Unknown Exercise'
    if (!acc[name]) {
      acc[name] = { name, sets: 0, maxWeight: 0, repsArray: [] }
    }
    acc[name].sets += 1
    acc[name].repsArray.push(set.actual_reps)
    if (set.actual_weight > acc[name].maxWeight) {
      acc[name].maxWeight = set.actual_weight
    }
    return acc
  }, {} as Record<string, { name: string, sets: number, maxWeight: number, repsArray: number[] }>)

  const groupedLiftsArray = Object.values(groupedLifts)
  
  const isCanvasEmpty = initialRunningLogs.length === 0 && completedExercises.length === 0

  return (
    <div className="space-y-6">
      
      {/* 1. RENDER COMPLETED CARDIO */}
      {initialRunningLogs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Completed Cardio</h3>
          {initialRunningLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-900 capitalize flex items-center gap-2">
                  🏃 {log.environment} {log.session_type}
                </p>
                <p className="text-sm text-gray-500">
                  {Math.round(log.duration_seconds / 60)} mins 
                  {log.average_incline ? ` @ ${log.average_incline}% inc` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{log.distance_km} <span className="text-xs font-normal text-gray-500">km</span></p>
                <p className="text-sm text-gray-500">{log.average_speed} <span className="text-xs">km/h</span></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. RENDER COMPLETED LIFTS */}
      {groupedLiftsArray.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-6">Completed Lifts</h3>
          {groupedLiftsArray.map((lift, index) => (
             <div key={index} className="bg-white px-4 py-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1">
               <div className="flex justify-between items-center">
                 <p className="font-bold text-gray-900 text-[15px]">{lift.name}</p>
                 <p className="font-bold text-gray-900">
                   {lift.maxWeight} <span className="text-xs font-normal text-gray-500">kg</span>
                 </p>
               </div>
               <p className="text-sm text-gray-500 font-medium">
                 {lift.sets} sets • {lift.repsArray.join('-')} reps
               </p>
             </div>
          ))}
        </div>
      )}

      {/* 3. SHOW BUTTONS IF NO FORM IS OPEN */}
      {activeModule === 'none' && (
        <>
          {isCanvasEmpty && (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50/50 mt-6">
              <p className="text-gray-400 font-medium text-sm">Your canvas is empty.</p>
              <p className="text-gray-400 text-xs mt-1">Add a module below to start training.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mt-6">
            <button 
              onClick={() => setActiveModule('cardio')}
              className="bg-white border border-gray-200 text-gray-900 font-bold py-4 rounded-xl shadow-sm hover:border-black transition-colors flex flex-col items-center gap-2"
            >
              <span className="text-2xl">🏃</span>
              <span className="text-sm">Add Cardio</span>
            </button>
            
            <button 
              onClick={() => setActiveModule('strength')}
              className="bg-white border border-gray-200 text-gray-900 font-bold py-4 rounded-xl shadow-sm hover:border-black transition-colors flex flex-col items-center gap-2"
            >
              <span className="text-2xl">🏋️</span>
              <span className="text-sm">Add Strength</span>
            </button>
          </div>
        </>
      )}

      {/* 4. ACTIVE FORMS */}
      {activeModule === 'cardio' && (
         <CardioForm workoutId={workoutId} onCancel={() => setActiveModule('none')} />
      )}
      
      {activeModule === 'strength' && (
         <StrengthForm 
           workoutId={workoutId} 
           exercises={exercises} 
           onCancel={() => setActiveModule('none')} 
         />
      )}
      
    </div>
  )
}