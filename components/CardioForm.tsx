'use client'

import { useState } from 'react'
import { saveCardioLog } from '@/app/workout/actions'

type IntervalLeg = {
  id: string
  type: 'warmup' | 'work' | 'rest' | 'cooldown'
  duration: number // minutes
  speed: number // km/h
  incline: number // percentage
}

export default function CardioForm({ 
  workoutId, 
  onCancel 
}: { 
  workoutId: string, 
  onCancel: () => void 
}) {
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor'>('indoor')
  const [sessionType, setSessionType] = useState<'interval' | 'distance'>('interval')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Standard Norwegian 4x4 Prefill
  const [legs, setLegs] = useState<IntervalLeg[]>([
    { id: 'L1', type: 'warmup', duration: 10, speed: 6.0, incline: 1.0 },
    { id: 'L2', type: 'work', duration: 4, speed: 10.0, incline: 1.0 },
    { id: 'L3', type: 'rest', duration: 2, speed: 5.5, incline: 1.0 },
    { id: 'L4', type: 'work', duration: 4, speed: 10.0, incline: 1.0 },
    { id: 'L5', type: 'rest', duration: 2, speed: 5.5, incline: 1.0 },
    { id: 'L6', type: 'work', duration: 4, speed: 10.0, incline: 1.0 },
    { id: 'L7', type: 'rest', duration: 2, speed: 5.5, incline: 1.0 },
    { id: 'L8', type: 'work', duration: 4, speed: 10.0, incline: 1.0 },
  ])

  // --- DERIVED SUMMARY STATE ---
  const workLegs = legs.filter(l => l.type === 'work')
  const restLegs = legs.filter(l => l.type === 'rest')
  const workCount = workLegs.length
  
  const allWorkSameDuration = workCount > 0 && workLegs.every(l => l.duration === workLegs[0].duration)
  
  const protocolName = workCount === 0 
    ? 'Recovery' 
    : (allWorkSameDuration ? `${workCount}x${workLegs[0].duration}` : `${workCount} Intervals`)

  const liveTotalMins = legs.reduce((sum, leg) => sum + leg.duration, 0)
  const liveTotalKm = legs.reduce((sum, leg) => sum + (leg.speed * (leg.duration / 60)), 0).toFixed(2)

  // References for the Master Sync controls
  const firstWork = workLegs[0]
  const firstRest = restLegs[0]

  // --- HANDLERS ---
  
  // Updates a single individual leg (e.g. if you want the last work leg to be faster)
  const updateLeg = (id: string, field: keyof IntervalLeg, delta: number) => {
    setLegs(legs.map(leg => {
      if (leg.id === id) {
        const newValue = Math.max(0, Number((leg[field as keyof typeof leg] as number) + delta))
        return { ...leg, [field]: Number(newValue.toFixed(1)) }
      }
      return leg
    }))
  }

  // Master Sync: Reads the first leg of that type, applies the delta, and overwrites ALL legs of that type
  const syncAndUpdateAll = (type: 'work' | 'rest', field: keyof IntervalLeg, delta: number) => {
    const referenceLeg = type === 'work' ? firstWork : firstRest
    if (!referenceLeg) return
    
    const newValue = Math.max(0, Number((referenceLeg[field as keyof typeof referenceLeg] as number) + delta))
    
    setLegs(legs.map(leg => {
      if (leg.type === type) {
        return { ...leg, [field]: Number(newValue.toFixed(1)) }
      }
      return leg
    }))
  }

  const addLeg = (type: 'work' | 'rest' | 'cooldown') => {
    const newId = `L${Date.now()}`
    let defaults = { duration: 4, speed: 10.0, incline: 1.0 }
    if (type === 'rest') defaults = { duration: 2, speed: 5.5, incline: 1.0 }
    if (type === 'cooldown') defaults = { duration: 5, speed: 5.0, incline: 0.0 }
    
    setLegs([...legs, { id: newId, type, ...defaults }])
  }

  const removeLeg = (idToRemove: string) => {
    setLegs(legs.filter(leg => leg.id !== idToRemove))
  }

  async function clientSubmit(formData: FormData) {
    setIsSubmitting(true)

    if (sessionType === 'interval') {
      const totalDurationMins = legs.reduce((sum, leg) => sum + leg.duration, 0)
      const totalDistanceKm = legs.reduce((sum, leg) => sum + (leg.speed * (leg.duration / 60)), 0)
      const averageSpeed = totalDistanceKm / (totalDurationMins / 60)
      const weightedInclineSum = legs.reduce((sum, leg) => sum + (leg.incline * leg.duration), 0)
      const averageIncline = weightedInclineSum / totalDurationMins

      formData.set('duration', totalDurationMins.toString())
      formData.set('distance', totalDistanceKm.toFixed(2))
      formData.set('average_speed', averageSpeed.toFixed(2))
      formData.set('incline', averageIncline.toFixed(2))
    }

    await saveCardioLog(formData)
    setIsSubmitting(false)
    onCancel()
  }

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">🏃 Log Cardio</h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      <form action={clientSubmit} className="space-y-6">
        <input type="hidden" name="workout_id" value={workoutId} />
        <input type="hidden" name="environment" value={environment} />
        <input type="hidden" name="session_type" value={sessionType} />
        <input type="hidden" name="legs" value={JSON.stringify(legs)} />

        {/* Environment Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button type="button" onClick={() => setEnvironment('indoor')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${environment === 'indoor' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>
            Treadmill
          </button>
          <button type="button" onClick={() => setEnvironment('outdoor')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${environment === 'outdoor' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>
            Outdoor
          </button>
        </div>

        {/* Session Type Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button type="button" onClick={() => setSessionType('interval')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${sessionType === 'interval' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>
            Intervals
          </button>
          <button type="button" onClick={() => setSessionType('distance')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${sessionType === 'distance' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>
            Distance Run
          </button>
        </div>

        {/* =========================================
            INTERVAL BUILDER UI
            ========================================= */}
        {sessionType === 'interval' && (
          <div className="space-y-4">
            
            {/* 1. LIVE SUMMARY BANNER */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏱️</span>
                <div>
                  <div className="font-extrabold text-gray-900 text-sm">{protocolName} <span className="font-medium text-gray-500">Protocol</span></div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900 text-sm">{liveTotalMins} <span className="text-xs font-normal text-gray-500">min</span></div>
                <div className="font-bold text-gray-900 text-sm">{liveTotalKm} <span className="text-xs font-normal text-gray-500">km</span></div>
              </div>
            </div>

            {/* 2. THE NEW BULK SYNC CONTROLS (DARK UI) */}
            {(workLegs.length > 1 || restLegs.length > 1) && (
              <div className="bg-gray-900 p-3 rounded-xl shadow-inner space-y-3">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Sync & Adjust All</h4>
                
                {workLegs.length > 1 && firstWork && (
                  <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">⚡ Master Work</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
                        <button type="button" onClick={() => syncAndUpdateAll('work', 'duration', -1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-l-lg">-</button>
                        <div className="flex-1 text-center leading-tight">
                          <div className="font-bold text-white text-sm">{firstWork.duration}</div>
                          <div className="text-[9px] text-gray-500 font-semibold uppercase">min</div>
                        </div>
                        <button type="button" onClick={() => syncAndUpdateAll('work', 'duration', 1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-r-lg">+</button>
                      </div>
                      <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
                        <button type="button" onClick={() => syncAndUpdateAll('work', 'speed', -0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-l-lg">-</button>
                        <div className="flex-1 text-center leading-tight">
                          <div className="font-bold text-white text-sm">{firstWork.speed}</div>
                          <div className="text-[9px] text-gray-500 font-semibold uppercase">km/h</div>
                        </div>
                        <button type="button" onClick={() => syncAndUpdateAll('work', 'speed', 0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-r-lg">+</button>
                      </div>
                      {environment === 'indoor' ? (
                        <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
                          <button type="button" onClick={() => syncAndUpdateAll('work', 'incline', -0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-l-lg">-</button>
                          <div className="flex-1 text-center leading-tight">
                            <div className="font-bold text-white text-sm">{firstWork.incline}</div>
                            <div className="text-[9px] text-gray-500 font-semibold uppercase">%</div>
                          </div>
                          <button type="button" onClick={() => syncAndUpdateAll('work', 'incline', 0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-r-lg">+</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700 text-xs font-semibold text-gray-500">Flat</div>
                      )}
                    </div>
                  </div>
                )}

                {restLegs.length > 1 && firstRest && (
                  <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">🌊 Master Rest</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
                        <button type="button" onClick={() => syncAndUpdateAll('rest', 'duration', -1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-l-lg">-</button>
                        <div className="flex-1 text-center leading-tight">
                          <div className="font-bold text-white text-sm">{firstRest.duration}</div>
                          <div className="text-[9px] text-gray-500 font-semibold uppercase">min</div>
                        </div>
                        <button type="button" onClick={() => syncAndUpdateAll('rest', 'duration', 1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-r-lg">+</button>
                      </div>
                      <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
                        <button type="button" onClick={() => syncAndUpdateAll('rest', 'speed', -0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-l-lg">-</button>
                        <div className="flex-1 text-center leading-tight">
                          <div className="font-bold text-white text-sm">{firstRest.speed}</div>
                          <div className="text-[9px] text-gray-500 font-semibold uppercase">km/h</div>
                        </div>
                        <button type="button" onClick={() => syncAndUpdateAll('rest', 'speed', 0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-r-lg">+</button>
                      </div>
                      {environment === 'indoor' ? (
                        <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
                          <button type="button" onClick={() => syncAndUpdateAll('rest', 'incline', -0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-l-lg">-</button>
                          <div className="flex-1 text-center leading-tight">
                            <div className="font-bold text-white text-sm">{firstRest.incline}</div>
                            <div className="text-[9px] text-gray-500 font-semibold uppercase">%</div>
                          </div>
                          <button type="button" onClick={() => syncAndUpdateAll('rest', 'incline', 0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-400 active:bg-gray-700 rounded-r-lg">+</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700 text-xs font-semibold text-gray-500">Flat</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. INDIVIDUAL LEGS LIST */}
            <div className="space-y-2">
              {legs.map((leg) => (
                <div key={leg.id} className="bg-gray-50 p-2 rounded-xl border border-gray-100 relative group">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      leg.type === 'warmup' ? 'text-orange-500' :
                      leg.type === 'work' ? 'text-red-500' :
                      leg.type === 'rest' ? 'text-blue-500' : 'text-gray-500'
                    }`}>
                      {leg.type}
                    </span>
                    <button type="button" onClick={() => removeLeg(leg.id)} className="text-gray-400 hover:text-red-500 font-bold text-lg leading-none">×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div className="flex items-center bg-white rounded-lg border border-gray-200">
                      <button type="button" onClick={() => updateLeg(leg.id, 'duration', -1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
                      <div className="flex-1 text-center leading-tight">
                        <div className="font-bold text-gray-900 text-sm">{leg.duration}</div>
                        <div className="text-[9px] text-gray-400 font-semibold uppercase">min</div>
                      </div>
                      <button type="button" onClick={() => updateLeg(leg.id, 'duration', 1)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
                    </div>
                    <div className="flex items-center bg-white rounded-lg border border-gray-200">
                      <button type="button" onClick={() => updateLeg(leg.id, 'speed', -0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
                      <div className="flex-1 text-center leading-tight">
                        <div className="font-bold text-gray-900 text-sm">{leg.speed}</div>
                        <div className="text-[9px] text-gray-400 font-semibold uppercase">km/h</div>
                      </div>
                      <button type="button" onClick={() => updateLeg(leg.id, 'speed', 0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
                    </div>
                    {environment === 'indoor' ? (
                      <div className="flex items-center bg-white rounded-lg border border-gray-200">
                        <button type="button" onClick={() => updateLeg(leg.id, 'incline', -0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-l-lg">-</button>
                        <div className="flex-1 text-center leading-tight">
                          <div className="font-bold text-gray-900 text-sm">{leg.incline}</div>
                          <div className="text-[9px] text-gray-400 font-semibold uppercase">%</div>
                        </div>
                        <button type="button" onClick={() => updateLeg(leg.id, 'incline', 0.5)} className="w-8 h-9 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 rounded-r-lg">+</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200 text-xs font-semibold text-gray-400">Flat</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => addLeg('work')} className="flex-1 border-2 border-dashed border-red-200 text-red-500 font-bold rounded-xl py-2 text-sm hover:border-red-400 transition-colors">+ Work</button>
              <button type="button" onClick={() => addLeg('rest')} className="flex-1 border-2 border-dashed border-blue-200 text-blue-500 font-bold rounded-xl py-2 text-sm hover:border-blue-400 transition-colors">+ Rest</button>
            </div>
          </div>
        )}

        {/* =========================================
            DISTANCE RUN UI
            ========================================= */}
        {sessionType === 'distance' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Time (mins)</label>
              <input type="number" name="duration" placeholder="45" required className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-black outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dist (km)</label>
              <input type="number" step="0.1" name="distance" placeholder="10.0" required className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-black outline-none" />
            </div>
            {environment === 'indoor' && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Avg Incline (%)</label>
                <input type="number" step="0.5" name="incline" placeholder="1.0" className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-black outline-none" />
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 mt-6">
          {isSubmitting ? 'Saving...' : 'Save Cardio Data'}
        </button>
      </form>
    </div>
  )
}