'use client'

import { useState } from 'react'
import Link from 'next/link'

type Settings = {
  protocol?: string
  target_sets?: number
  target_reps?: number
  target_reps_min?: number
  current_weight?: number
  increment_step?: number
  progression_rate?: number
  min_successes?: number
  max_failures?: number
  deload_multiplier?: number
}

// ─── Reusable stepper ────────────────────────────────────────────────────────
function NumericStepper({
  label,
  name,
  value,
  onChange,
  step = 1,
  min = 0,
  accent,
}: {
  label: string
  name: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  /** 'blue' | 'green' | 'red' | undefined (defaults to gray) */
  accent?: string
}) {
  const borderColor =
    accent === 'green' ? 'border-green-200' :
    accent === 'red'   ? 'border-red-200'   :
    accent === 'blue'  ? 'border-blue-200'  :
    'border-gray-200'
  const labelColor =
    accent === 'green' ? 'text-green-500' :
    accent === 'red'   ? 'text-red-500'   :
    accent === 'blue'  ? 'text-blue-500'  :
    'text-gray-500'

  const decrement = () => onChange(parseFloat(Math.max(min, value - step).toFixed(6)))
  const increment = () => onChange(parseFloat((value + step).toFixed(6)))

  return (
    <div>
      <label className={`block text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>{label}</label>
      <div className={`flex items-center mt-1 rounded-lg border ${borderColor} overflow-hidden bg-white`}>
        <button
          type="button"
          onClick={decrement}
          className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 shrink-0 border-r border-gray-100"
        >−</button>
        <input
          type="number"
          name={name}
          value={value}
          onChange={e => {
            const parsed = parseFloat(e.target.value)
            if (!isNaN(parsed)) onChange(Math.max(min, parsed))
          }}
          className="flex-1 min-w-0 text-center bg-white py-2 font-bold text-sm outline-none"
        />
        <button
          type="button"
          onClick={increment}
          className="w-9 h-10 flex items-center justify-center font-bold text-gray-500 active:bg-gray-100 shrink-0 border-l border-gray-100"
        >+</button>
      </div>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function ExerciseSettingsFields({
  settings,
  exerciseId,
  exerciseName,
}: {
  settings?: Settings | null
  /** When provided, shows a Goals shortcut link at the bottom of the panel */
  exerciseId?: string
  exerciseName?: string
}) {
  const [protocol,     setProtocol]     = useState(settings?.protocol         ?? 'manual')
  const [sets,         setSets]         = useState(settings?.target_sets      ?? 5)
  const [reps,         setReps]         = useState(settings?.target_reps      ?? 5)
  const [repsMin,      setRepsMin]      = useState(settings?.target_reps_min  ?? 8)
  const [weight,       setWeight]       = useState(settings?.current_weight   ?? 60)
  const [increment,    setIncrement]    = useState(settings?.increment_step   ?? 2.5)
  const [progRate,     setProgRate]     = useState(settings?.progression_rate ?? 2.5)
  const [minSuccesses, setMinSuccesses] = useState(settings?.min_successes    ?? 1)
  const [maxFailures,  setMaxFailures]  = useState(settings?.max_failures     ?? 3)
  const [deloadMult,   setDeloadMult]   = useState(settings?.deload_multiplier ?? 2.0)

  const isDouble = protocol === 'double'

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Protocol */}
      <div className="col-span-2">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Progression Protocol</label>
        <select
          name="protocol"
          value={protocol}
          onChange={e => setProtocol(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-bold mt-1 text-sm outline-none focus:border-black"
        >
          <option value="manual">Manual (No Auto-Progression)</option>
          <option value="linear">Linear (e.g., 5x5)</option>
          <option value="double">Double Progression (e.g., 3x8-12)</option>
        </select>
      </div>

      {/* Sets + Reps (single target for linear/manual, range for double) */}
      <NumericStepper label="Sets" name="sets" value={sets} onChange={setSets} step={1} min={1} />

      {isDouble ? (
        <>
          {/* "reps" = upper bound (max), "reps_min" = lower bound */}
          <NumericStepper
            label="Min Reps"
            name="reps_min"
            value={repsMin}
            onChange={v => setRepsMin(Math.min(v, reps - 1))}
            step={1} min={1}
          />
          <NumericStepper
            label="Max Reps"
            name="reps"
            value={reps}
            onChange={v => setReps(Math.max(v, repsMin + 1))}
            step={1} min={1}
          />
        </>
      ) : (
        <>
          <NumericStepper label="Reps" name="reps" value={reps} onChange={setReps} step={1} min={1} />
          {/* Always submit reps_min so the engine always has it */}
          <input type="hidden" name="reps_min" value={repsMin} />
        </>
      )}

      <div className="col-span-2 border-t border-gray-200 my-1 pt-2" />

      {/* Weight (steps by the current increment) + UI Increment */}
      <NumericStepper
        label="Target Weight"
        name="weight"
        value={weight}
        onChange={setWeight}
        step={increment}
        min={0}
      />
      <NumericStepper
        label="UI Increment (+/−)"
        name="increment"
        value={increment}
        onChange={setIncrement}
        step={0.5}
        min={0.5}
        accent="blue"
      />

      <div className="col-span-2 border-t border-gray-200 my-1 pt-2" />

      {/* Success-side settings */}
      <NumericStepper
        label="Auto-Progression Step"
        name="progression_rate"
        value={progRate}
        onChange={setProgRate}
        step={0.5}
        min={0}
        accent="green"
      />
      <NumericStepper
        label="Min Successes"
        name="min_successes"
        value={minSuccesses}
        onChange={setMinSuccesses}
        step={1}
        min={1}
        accent="green"
      />

      {/* Failure-side settings */}
      <NumericStepper
        label="Max Failures"
        name="max_failures"
        value={maxFailures}
        onChange={setMaxFailures}
        step={1}
        min={1}
        accent="red"
      />
      <NumericStepper
        label="Deload Multiplier"
        name="deload_multiplier"
        value={deloadMult}
        onChange={setDeloadMult}
        step={0.5}
        min={0.5}
        accent="red"
      />

      {/* Goals shortcut — only rendered when exerciseId is provided */}
      {exerciseId && (
        <div className="col-span-2 pt-1">
          <Link
            href="/goals"
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🎯</span>
              <span className="text-xs font-bold text-gray-700 group-hover:text-gray-900">
                {exerciseName ? `Goals for ${exerciseName}` : 'Goals'}
              </span>
            </div>
            <span className="text-gray-400 text-xs font-bold group-hover:text-gray-600">→</span>
          </Link>
        </div>
      )}
    </div>
  )
}
