type Settings = {
  protocol?: string
  target_sets?: number
  target_reps?: number
  current_weight?: number
  increment_step?: number
  progression_rate?: number
  min_successes?: number
  max_failures?: number
  deload_multiplier?: number
}

export default function ExerciseSettingsFields({ settings }: { settings?: Settings | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-[10px] font-bold text-gray-500 uppercase">Progression Protocol</label>
        <select name="protocol" defaultValue={settings?.protocol || 'manual'} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-bold mt-1 text-sm outline-none focus:border-black">
          <option value="manual">Manual (No Auto-Progression)</option>
          <option value="linear">Linear (e.g., 5x5)</option>
          <option value="double">Double Progression (e.g., 3x8-12)</option>
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase">Sets</label>
        <input type="number" name="sets" defaultValue={settings?.target_sets || 5} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-bold mt-1" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase">Reps</label>
        <input type="number" name="reps" defaultValue={settings?.target_reps || 5} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-bold mt-1" />
      </div>

      <div className="col-span-2 border-t border-gray-200 my-1 pt-2"></div>

      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase">Target Weight</label>
        <input type="number" step="0.5" name="weight" defaultValue={settings?.current_weight || 60} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-bold mt-1" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase text-blue-500">UI Increment (+/-)</label>
        <input type="number" step="0.5" name="increment" defaultValue={settings?.increment_step || 2.5} className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 font-bold mt-1" />
      </div>

      <div className="col-span-2 border-t border-gray-200 my-1 pt-2"></div>

      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase text-green-500">Auto-Progression Step</label>
        <input type="number" step="0.5" name="progression_rate" defaultValue={settings?.progression_rate || 2.5} className="w-full bg-white border border-green-200 rounded-lg px-3 py-2 font-bold mt-1" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase text-green-500">Min Successes</label>
        <input type="number" min="1" name="min_successes" defaultValue={settings?.min_successes || 1} className="w-full bg-white border border-green-200 rounded-lg px-3 py-2 font-bold mt-1" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase text-red-500">Max Failures</label>
        <input type="number" name="max_failures" defaultValue={settings?.max_failures || 3} className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 font-bold mt-1" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase text-red-500">Deload Multiplier</label>
        <input type="number" step="0.5" name="deload_multiplier" defaultValue={settings?.deload_multiplier || 2.0} className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 font-bold mt-1" />
      </div>
    </div>
  )
}
