'use client'

import { useState } from 'react'
import { saveCardioLog } from '@/app/workout/actions'

export default function CardioForm({ workoutId, onCancel }: { workoutId: string, onCancel: () => void }) {
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor'>('indoor')
  const [sessionType, setSessionType] = useState<'interval' | 'distance'>('interval')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Wrapper function to handle the form submission state
  async function clientSubmit(formData: FormData) {
    setIsSubmitting(true)
    await saveCardioLog(formData)
    setIsSubmitting(false)
    onCancel() // Close the form after successful save
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">🏃 Log Cardio</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-900 font-bold p-2">✕</button>
      </div>

      <form action={clientSubmit} className="space-y-6">
        {/* Hidden field to pass the ID to the server */}
        <input type="hidden" name="workout_id" value={workoutId} />
        <input type="hidden" name="environment" value={environment} />
        <input type="hidden" name="session_type" value={sessionType} />

        {/* Big Touch Targets for Environment */}
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

        {/* Big Touch Targets for Session Type */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button type="button" onClick={() => setSessionType('interval')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${sessionType === 'interval' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>
            4x4 Intervals
          </button>
          <button type="button" onClick={() => setSessionType('distance')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${sessionType === 'distance' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>
            Distance Run
          </button>
        </div>

        {/* The Smart Input Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Time (mins)</label>
            <input type="number" name="duration" placeholder="45" required 
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-black outline-none" />
          </div>

          {/* If Distance Run, ask for Distance. If Interval, ask for Speed. */}
          {sessionType === 'distance' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dist (km)</label>
              <input type="number" step="0.1" name="distance" placeholder="10.0" required
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-black outline-none" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Speed (km/h)</label>
              <input type="number" step="0.1" name="average_speed" placeholder="14.0" required
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-black outline-none" />
            </div>
          )}

          {/* Only show incline if they are on a treadmill */}
          {environment === 'indoor' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Incline (%)</label>
              <input type="number" step="0.5" name="incline" placeholder="2.0" 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-black outline-none" />
            </div>
          )}
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full bg-black text-white font-bold rounded-xl py-4 shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50">
          {isSubmitting ? 'Saving...' : 'Save Cardio Data'}
        </button>
      </form>
    </div>
  )
}