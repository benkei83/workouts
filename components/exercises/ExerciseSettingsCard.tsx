'use client'

import { useTransition, useState } from 'react'
import ExerciseSettingsFields from '@/components/ExerciseSettingsFields'
import { MUSCLE_GROUPS, EQUIPMENT_LABELS } from '@/lib/muscleGroups'
import { saveExerciseTags, saveExerciseSettings } from '@/app/exercises/[id]/actions'

type Settings = {
  target_sets?: number | null
  target_reps?: number | null
  target_reps_min?: number | null
  current_weight?: number | null
  increment_step?: number | null
  progression_rate?: number | null
  protocol?: string | null
  max_failures?: number | null
  min_successes?: number | null
  deload_multiplier?: number | null
  suppress_prs?: boolean | null
  pr_min_weight?: number | null
}

function SaveStatus({ status, msg }: { status: 'idle' | 'saving' | 'saved' | 'error'; msg?: string }) {
  if (status === 'saving') return <p className="text-xs text-gray-400 font-medium">Saving…</p>
  if (status === 'saved')  return <p className="text-xs text-green-600 font-semibold">✓ Saved</p>
  if (status === 'error')  return <p className="text-xs text-red-500 font-semibold">{msg}</p>
  return null
}

export default function ExerciseSettingsCard({
  exerciseId,
  exerciseName,
  muscleGroup,
  equipment,
  settings,
}: {
  exerciseId:   string
  exerciseName: string
  muscleGroup:  string | null
  equipment:    string | null
  settings:     Settings | null
}) {
  const [tagsPending, startTagsTransition]     = useTransition()
  const [settingsPending, startSettingsTransition] = useTransition()
  const [tagsStatus, setTagsStatus]     = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [settingsStatus, setSettingsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [tagsError, setTagsError]       = useState<string>('')
  const [settingsError, setSettingsError] = useState<string>('')

  function handleTags(formData: FormData) {
    setTagsStatus('saving')
    startTagsTransition(async () => {
      const result = await saveExerciseTags(exerciseId, formData)
      if ('error' in result) { setTagsStatus('error'); setTagsError(result.error ?? 'Unknown error') }
      else { setTagsStatus('saved'); setTimeout(() => setTagsStatus('idle'), 2500) }
    })
  }

  function handleSettings(formData: FormData) {
    setSettingsStatus('saving')
    startSettingsTransition(async () => {
      const result = await saveExerciseSettings(exerciseId, formData)
      if ('error' in result) { setSettingsStatus('error'); setSettingsError(result.error ?? 'Unknown error') }
      else { setSettingsStatus('saved'); setTimeout(() => setSettingsStatus('idle'), 2500) }
    })
  }

  return (
    <div className="space-y-6 pt-4">

      {/* ── Tags ── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tags</p>
        <form action={handleTags} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Muscle Group</label>
            <select
              name="muscle_group"
              defaultValue={muscleGroup ?? ''}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">— none —</option>
              {MUSCLE_GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Equipment</label>
            <select
              name="equipment"
              defaultValue={equipment ?? ''}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none"
            >
              <option value="">— none —</option>
              {Object.entries(EQUIPMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={tagsPending}
              className="bg-gray-800 text-white font-bold rounded-xl px-5 py-2.5 text-sm disabled:opacity-50 hover:bg-black transition-colors"
            >
              Save Tags
            </button>
            <SaveStatus status={tagsStatus} msg={tagsError} />
          </div>
        </form>
      </div>

      {/* ── Training Settings + PR Notifications ── */}
      <div className="border-t border-gray-100 pt-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Training Settings</p>
        <form action={handleSettings} className="space-y-4">
          <ExerciseSettingsFields
            settings={settings as any}
            exerciseId={exerciseId}
            exerciseName={exerciseName}
          />

          {/* PR notifications */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">PR Notifications</p>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-gray-800">Suppress all PR badges</p>
                <p className="text-xs text-gray-400 mt-0.5">Never mark sets as PRs for this exercise</p>
              </div>
              <input
                type="checkbox"
                name="suppress_prs"
                defaultChecked={settings?.suppress_prs ?? false}
                className="w-5 h-5 rounded accent-gray-900 cursor-pointer"
              />
            </label>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Suppress until I lift at least
              </label>
              <p className="text-xs text-gray-400 mb-2">PRs are ignored below this weight. Leave empty to disable.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="pr_min_weight"
                  min="0"
                  step="2.5"
                  defaultValue={settings?.pr_min_weight ?? ''}
                  placeholder="e.g. 100"
                  className="w-32 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none"
                />
                <span className="text-sm text-gray-500 font-medium">kg</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="submit"
              disabled={settingsPending}
              className="w-full bg-black text-white font-bold rounded-xl py-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {settingsPending ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
          <div className="text-center">
            <SaveStatus status={settingsStatus} msg={settingsError} />
          </div>
        </form>
      </div>

    </div>
  )
}
