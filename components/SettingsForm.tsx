'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { updateUserSettings } from '@/app/settings/actions'
import type { UserSettings } from '@/lib/settings'
import PushSubscribeButton from '@/components/PushSubscribeButton'

const REST_PRESETS: { label: string; value: number | null }[] = [
  { label: '↑ Count up', value: null  },
  { label: '1:00',       value: 60    },
  { label: '1:30',       value: 90    },
  { label: '2:00',       value: 120   },
  { label: '3:00',       value: 180   },
  { label: '5:00',       value: 300   },
]

// ── Reusable toggle ────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
        on ? 'bg-gray-900' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Saved ✓ flash ──────────────────────────────────────────────────────────────
function SavedBadge({ show }: { show: boolean }) {
  return (
    <span className={`text-xs font-semibold text-green-500 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      Saved ✓
    </span>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
      <div className="px-4 py-3">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>
}

// ── Main form ──────────────────────────────────────────────────────────────────
export default function SettingsForm({
  settings,
  exercises = [],
}: {
  settings: UserSettings
  exercises?: { id: string; name: string }[]
}) {
  // ── Profile ────────────────────────────────────────────────────────────────
  const [screenName, setScreenName] = useState(settings.screen_name ?? '')
  const [nameSaved, setNameSaved] = useState(false)
  const [namePending, startNameTransition] = useTransition()
  const nameSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Body ───────────────────────────────────────────────────────────────────
  const [heightCm, setHeightCm] = useState<string>(settings.height_cm != null ? String(settings.height_cm) : '')
  const [heightSaved, setHeightSaved] = useState(false)
  const [heightPending, startHeightTransition] = useTransition()

  // ── Training ───────────────────────────────────────────────────────────────
  const [restSecs, setRestSecs]   = useState<number | null>(settings.rest_timer_default_secs)
  const [vibrate, setVibrate]     = useState(settings.vibrate_on_rest_complete)
  const [sound, setSound]         = useState(settings.sound_on_rest_complete)
  const [vibrateSupported, setVibrateSupported] = useState(false)
  const [restSaved, setRestSaved]     = useState(false)
  const [vibrateSaved, setVibrateSaved] = useState(false)
  const [soundSaved, setSoundSaved]     = useState(false)

  // ── Community ──────────────────────────────────────────────────────────────
  const [autoShare, setAutoShare]     = useState(settings.auto_share_workouts)
  const [autoShareSaved, setAutoShareSaved] = useState(false)

  // ── Notifications ──────────────────────────────────────────────────────────
  const [trophyToast, setTrophyToast] = useState(settings.show_trophy_toasts)
  const [toastSaved, setToastSaved]   = useState(false)

  // ── Focus mode ─────────────────────────────────────────────────────────────
  const [focusOn,        setFocusOn]        = useState(!!settings.focus_exercise_id)
  const [focusExId,      setFocusExId]      = useState(settings.focus_exercise_id ?? '')
  const [focusSaved,     setFocusSaved]     = useState(false)
  const [focusPending,   startFocusTransition] = useTransition()

  // Detect vibration support client-side (not available in iOS Safari)
  useEffect(() => {
    setVibrateSupported('vibrate' in navigator)
  }, [])

  const flash = (set: (v: boolean) => void, timerRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    set(true)
    const t = setTimeout(() => set(false), 2000)
    if (timerRef) timerRef.current = t
  }

  const saveScreenName = () => {
    const trimmed = screenName.trim() || null
    startNameTransition(async () => {
      await updateUserSettings({ screen_name: trimmed })
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current)
      flash(setNameSaved, nameSavedTimer)
    })
  }

  const saveHeight = () => {
    const parsed = heightCm.trim() ? parseFloat(heightCm) : null
    const valid = parsed === null || (parsed > 50 && parsed < 280)
    if (!valid) return
    startHeightTransition(async () => {
      await updateUserSettings({ height_cm: parsed })
      flash(setHeightSaved)
    })
  }

  const handleRestPreset = async (value: number | null) => {
    setRestSecs(value)
    await updateUserSettings({ rest_timer_default_secs: value })
    flash(setRestSaved)
  }

  const handleVibrate = async () => {
    const next = !vibrate
    setVibrate(next)
    await updateUserSettings({ vibrate_on_rest_complete: next })
    flash(setVibrateSaved)
  }

  const handleSound = async () => {
    const next = !sound
    setSound(next)
    await updateUserSettings({ sound_on_rest_complete: next })
    flash(setSoundSaved)
  }

  const handleAutoShare = async () => {
    const next = !autoShare
    setAutoShare(next)
    await updateUserSettings({ auto_share_workouts: next })
    flash(setAutoShareSaved)
  }

  const handleTrophyToast = async () => {
    const next = !trophyToast
    setTrophyToast(next)
    await updateUserSettings({ show_trophy_toasts: next })
    flash(setToastSaved)
  }

  const handleFocusToggle = () => {
    const next = !focusOn
    setFocusOn(next)
    startFocusTransition(async () => {
      if (!next) {
        // Turning off — clear the exercise
        await updateUserSettings({ focus_exercise_id: null })
        setFocusExId('')
      } else if (focusExId) {
        // Turning on with an already-selected exercise
        await updateUserSettings({ focus_exercise_id: focusExId })
      }
      flash(setFocusSaved)
    })
  }

  const handleFocusExercise = (id: string) => {
    setFocusExId(id)
    if (!id) return
    startFocusTransition(async () => {
      await updateUserSettings({ focus_exercise_id: id })
      flash(setFocusSaved)
    })
  }

  return (
    <div className="space-y-6">

      {/* ── PROFILE ── */}
      <Section title="Profile">
        <Row>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Screen name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={screenName}
              onChange={e => setScreenName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveScreenName()}
              placeholder="e.g. powerlifter_pete"
              maxLength={30}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <button
              type="button"
              onClick={saveScreenName}
              disabled={namePending}
              className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {namePending ? '…' : 'Save'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-xs text-gray-400 flex-1">
              Used in the social feed — coming soon.
            </p>
            <SavedBadge show={nameSaved} />
          </div>
        </Row>
      </Section>

      {/* ── BODY ── */}
      <Section title="Body">
        <Row>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Height
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={heightCm}
                onChange={e => setHeightCm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveHeight()}
                placeholder="e.g. 178"
                min={100}
                max={280}
                step={0.5}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">cm</span>
            </div>
            <button
              type="button"
              onClick={saveHeight}
              disabled={heightPending}
              className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {heightPending ? '…' : 'Save'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-xs text-gray-400 flex-1">Used for BMI on the weight tracker.</p>
            <SavedBadge show={heightSaved} />
          </div>
        </Row>
      </Section>

      {/* ── TRAINING ── */}
      <Section title="Training">
        {/* Rest timer presets */}
        <Row>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Default rest timer</p>
              <p className="text-xs text-gray-400 mt-0.5">Starts when you check off a set</p>
            </div>
            <SavedBadge show={restSaved} />
          </div>
          <div className="flex flex-wrap gap-2">
            {REST_PRESETS.map(preset => (
              <button
                key={String(preset.value)}
                type="button"
                onClick={() => handleRestPreset(preset.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  restSecs === preset.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </Row>

        {/* Vibration */}
        <Row>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-700">Vibrate when rest ends</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {vibrateSupported
                  ? 'Your device supports vibration.'
                  : 'Not available on this device (iOS Safari doesn\'t support it).'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SavedBadge show={vibrateSaved} />
              <Toggle
                on={vibrate && vibrateSupported}
                onChange={vibrateSupported ? handleVibrate : () => {}}
              />
            </div>
          </div>
          {!vibrateSupported && (
            <p className="text-[10px] text-amber-500 mt-2 font-medium">
              💡 Try opening the app in Chrome on Android for vibration support.
            </p>
          )}
        </Row>

        {/* Sound */}
        <Row>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-700">Beep when rest ends</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Plays two short beeps when your rest countdown hits zero.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SavedBadge show={soundSaved} />
              <Toggle on={sound} onChange={handleSound} />
            </div>
          </div>
        </Row>
      </Section>

      {/* ── COMMUNITY ── */}
      <Section title="Community">
        <Row>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-700">Auto-share workouts</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Post a summary card to the community feed every time you finish a workout. You can always remove individual posts later.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SavedBadge show={autoShareSaved} />
              <Toggle on={autoShare} onChange={handleAutoShare} />
            </div>
          </div>
        </Row>
      </Section>

      {/* ── NOTIFICATIONS ── */}
      <Section title="Notifications">
        <Row>
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-700">Trophy toasts</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Show a popup when you unlock a new trophy after finishing a workout.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SavedBadge show={toastSaved} />
              <Toggle on={trophyToast} onChange={handleTrophyToast} />
            </div>
          </div>
        </Row>
      </Section>

      {/* ── NOTIFICATIONS ── */}
      <Section title="Notifications">
        <Row>
          <PushSubscribeButton />
        </Row>
      </Section>

      {/* ── FOCUS MODE ── */}
      {exercises.length > 0 && (
        <Section title="Focus Mode">
          <Row>
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-sm font-semibold text-gray-700">Focus Mode</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Replaces the home screen with a single-exercise dashboard.
                  Everything else stays accessible via the menu.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SavedBadge show={focusSaved} />
                <Toggle
                  on={focusOn}
                  onChange={handleFocusToggle}
                />
              </div>
            </div>

            {focusOn && (
              <div className="mt-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Exercise
                </label>
                <select
                  value={focusExId}
                  onChange={e => handleFocusExercise(e.target.value)}
                  disabled={focusPending}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-700 focus:ring-2 focus:ring-black outline-none disabled:opacity-50"
                >
                  <option value="">— select an exercise —</option>
                  {exercises.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
                {focusExId && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    To turn off, toggle Focus Mode above.
                  </p>
                )}
              </div>
            )}
          </Row>
        </Section>
      )}

    </div>
  )
}
