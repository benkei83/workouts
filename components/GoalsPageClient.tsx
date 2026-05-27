'use client'

import { useState, useTransition, useEffect } from 'react'
import { createGoal, deleteGoal } from '@/app/goals/actions'

// ── Shared types (exported for page.tsx) ──────────────────────────────────────

export type GoalType = 'max_weight' | '1rm' | 'bw_multiple' | 'body_weight'

export interface ComputedGoal {
  id:             string
  goal_type:      GoalType
  target_value:   number
  starting_value: number | null
  label:          string | null
  deadline:       string | null
  achieved_at:    string | null
  created_at:     string
  exercise_id:    string | null
  exercise_name:  string | null
  // Computed server-side
  current_value:  number | null
  weekly_rate:    number | null   // kg/wk (or ratio/wk for bw_multiple)
  eta_date:       string | null   // ISO date
  progress_pct:   number          // 0–100
}

export interface AvailableExercise {
  id:   string
  name: string
}

interface Props {
  goals:              ComputedGoal[]
  availableExercises: AvailableExercise[]
  currentBodyWeight:  number | null
  newlyAchievedIds:   string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOAL_TYPE_META: Record<GoalType, { label: string; unit: string; icon: string; description: string }> = {
  max_weight:  { label: 'Max Weight',       unit: 'kg',  icon: '🏋️', description: 'Hit a target training weight for this exercise' },
  '1rm':       { label: 'Estimated 1RM',    unit: 'kg',  icon: '💪', description: 'Hit a target estimated one-rep max (Epley formula)' },
  bw_multiple: { label: 'Bodyweight ×',     unit: '×',   icon: '⚖️', description: 'Lift a multiple of your current body weight (live ratio)' },
  body_weight: { label: 'Target Body Weight', unit: 'kg', icon: '📉', description: 'Reach a specific body weight' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function deadlinePreset(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('en-CA')
}

function formatCurrentValue(goal: ComputedGoal): string {
  if (goal.current_value === null) return '—'
  switch (goal.goal_type) {
    case 'max_weight': return `${goal.current_value.toFixed(1)} kg`
    case '1rm':        return `~${goal.current_value.toFixed(0)} kg`
    case 'bw_multiple':return `${goal.current_value.toFixed(2)}×`
    case 'body_weight':return `${goal.current_value.toFixed(1)} kg`
  }
}

function formatTargetValue(goal: ComputedGoal): string {
  switch (goal.goal_type) {
    case 'max_weight': return `${goal.target_value.toFixed(1)} kg`
    case '1rm':        return `${goal.target_value.toFixed(0)} kg`
    case 'bw_multiple':return `${goal.target_value.toFixed(2)}×`
    case 'body_weight':return `${goal.target_value.toFixed(1)} kg`
  }
}

function formatWeeklyRate(goal: ComputedGoal): string | null {
  if (goal.weekly_rate === null || goal.weekly_rate === 0) return null
  const sign = goal.weekly_rate > 0 ? '+' : ''
  switch (goal.goal_type) {
    case 'bw_multiple': return `${sign}${goal.weekly_rate.toFixed(3)}×/wk`
    default:            return `${sign}${goal.weekly_rate.toFixed(2)} kg/wk`
  }
}

function progressColor(pct: number): string {
  if (pct >= 90) return 'bg-yellow-400'
  if (pct >= 60) return 'bg-green-500'
  if (pct >= 30) return 'bg-blue-500'
  return 'bg-gray-400'
}

function isOnTrack(goal: ComputedGoal): boolean | null {
  if (!goal.eta_date || !goal.deadline) return null
  return goal.eta_date <= goal.deadline
}

// ── Achievement celebration ───────────────────────────────────────────────────

function AchievementCelebration({
  goals,
  onDone,
}: {
  goals: ComputedGoal[]
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  if (goals.length === 0) return null

  const current = goals[index]
  const isLast  = index === goals.length - 1
  const meta    = GOAL_TYPE_META[current.goal_type]

  const advance = () => {
    if (isLast) { setVisible(false); setTimeout(onDone, 300) }
    else setIndex(i => i + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`
        relative w-full max-w-sm rounded-2xl border-2 border-yellow-300 p-6
        bg-gradient-to-br from-yellow-50 to-amber-50
        shadow-2xl transition-all duration-300
        ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}
      `}>
        {goals.length > 1 && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            {index + 1} / {goals.length}
          </p>
        )}

        <div className="text-center mb-5">
          <div className="text-5xl mb-3">🎯</div>
          <h2 className="text-xl font-extrabold text-gray-900">Goal Achieved!</h2>
          {(current.label || current.exercise_name) && (
            <p className="text-sm font-semibold text-gray-600 mt-1">
              {current.label || `${current.exercise_name} — ${meta.label}`}
            </p>
          )}
        </div>

        <div className="bg-white/60 rounded-xl p-4 mb-5 text-center">
          <p className="text-xs text-gray-500 mb-1">Target reached</p>
          <p className="text-2xl font-extrabold text-gray-900">{formatTargetValue(current)}</p>
          <p className="text-xs text-gray-500 mt-1">{meta.icon} {meta.label}</p>
        </div>

        <button
          onClick={advance}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gray-900 text-white hover:bg-gray-700 active:scale-95 transition-all"
        >
          {isLast ? '🏆 Awesome!' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, onDelete, isDeleting }: {
  goal:       ComputedGoal
  onDelete:   () => void
  isDeleting: boolean
}) {
  const meta      = GOAL_TYPE_META[goal.goal_type]
  const track     = isOnTrack(goal)
  const rateStr   = formatWeeklyRate(goal)
  const isAchieved = !!goal.achieved_at

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${isAchieved ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-100'}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-bold text-gray-500">{meta.icon} {meta.label}</span>
            {isAchieved && (
              <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                ✓ Achieved
              </span>
            )}
          </div>
          {goal.label ? (
            <p className="text-sm font-bold text-gray-900 truncate">{goal.label}</p>
          ) : goal.exercise_name ? (
            <p className="text-sm font-bold text-gray-900 truncate">{goal.exercise_name}</p>
          ) : (
            <p className="text-sm font-bold text-gray-500 italic">Body weight</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-[11px] text-gray-300 hover:text-red-400 transition-colors font-bold shrink-0 p-1 disabled:opacity-40"
          aria-label="Delete goal"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      {!isAchieved && (
        <div className="mb-3">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Progress</span>
            <span className="text-xs font-bold text-gray-700">{goal.progress_pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressColor(goal.progress_pct)}`}
              style={{ width: `${goal.progress_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Current → Target */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 font-medium mb-0.5">Current</p>
          <p className="text-base font-extrabold text-gray-900 tabular-nums">
            {formatCurrentValue(goal)}
          </p>
        </div>
        <span className="text-gray-300 font-bold">→</span>
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-400 font-medium mb-0.5">Target</p>
          <p className="text-base font-extrabold text-gray-900 tabular-nums">
            {formatTargetValue(goal)}
          </p>
        </div>
      </div>

      {/* Footer: rate, ETA, deadline */}
      {!isAchieved && (
        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
          {rateStr ? (
            <span className="text-gray-500 font-medium">{rateStr}</span>
          ) : (
            <span className="text-gray-400 font-medium">Not enough data for rate</span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {goal.eta_date && (
              <span className={`font-semibold tabular-nums ${
                track === false ? 'text-orange-500' : track === true ? 'text-green-600' : 'text-gray-600'
              }`}>
                ETA {formatDate(goal.eta_date)}
                {track === false && ' ⚠️'}
              </span>
            )}
            {goal.deadline && (
              <span className="text-gray-400 font-medium">
                · deadline {formatDate(goal.deadline)}
              </span>
            )}
          </div>
        </div>
      )}

      {isAchieved && (
        <p className="text-xs text-yellow-600 font-semibold mt-1">
          🏆 Achieved on {formatDate(goal.achieved_at)}
        </p>
      )}
    </div>
  )
}

// ── Add-goal form ─────────────────────────────────────────────────────────────

function AddGoalForm({
  availableExercises,
  currentBodyWeight,
  onDone,
  onCancel,
}: {
  availableExercises: AvailableExercise[]
  currentBodyWeight:  number | null
  onDone:   () => void
  onCancel: () => void
}) {
  const [goalType, setGoalType] = useState<GoalType>('max_weight')
  const [deadline, setDeadline] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const needsExercise = goalType !== 'body_weight'
  const meta = GOAL_TYPE_META[goalType]

  const handleSubmit = (fd: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await createGoal(fd)
      if (result.error) { setError(result.error); return }
      onDone()
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">New Goal</h2>
        <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-700 font-semibold transition-colors">
          Cancel
        </button>
      </div>

      {/* Goal type picker */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">Goal type</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(GOAL_TYPE_META) as GoalType[]).map(type => {
            const m = GOAL_TYPE_META[type]
            return (
              <button
                key={type}
                type="button"
                onClick={() => setGoalType(type)}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  goalType === type
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400'
                }`}
              >
                <span className="text-lg mb-1">{m.icon}</span>
                <span className="text-xs font-bold leading-snug">{m.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">{meta.description}</p>
      </div>

      <form action={handleSubmit} className="space-y-3">
        {/* Hidden goal type */}
        <input type="hidden" name="goal_type" value={goalType} />

        {/* Exercise selector */}
        {needsExercise && (
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Exercise</label>
            {availableExercises.length === 0 ? (
              <p className="text-xs text-orange-500 font-medium">
                No exercises found. Log a workout or configure exercise settings first.
              </p>
            ) : (
              <select
                name="exercise_id"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">— select exercise —</option>
                {availableExercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Target value */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">
            Target value ({meta.unit})
            {goalType === 'bw_multiple' && currentBodyWeight && (
              <span className="text-gray-400 font-normal ml-1">
                — e.g. 2.0 = {(2.0 * currentBodyWeight).toFixed(0)} kg at current BW
              </span>
            )}
          </label>
          <input
            name="target_value"
            type="number"
            step={goalType === 'bw_multiple' ? '0.05' : '0.5'}
            min={goalType === 'bw_multiple' ? '0.1' : '1'}
            max={goalType === 'bw_multiple' ? '10' : '1000'}
            required
            placeholder={goalType === 'bw_multiple' ? 'e.g. 2.0' : 'e.g. 100'}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Custom label */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Label (optional)</label>
          <input
            name="label"
            type="text"
            placeholder='e.g. "First 100 kg bench"'
            maxLength={60}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Deadline */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">Deadline (optional)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {[{ label: 'None', months: 0 }, { label: '3 months', months: 3 }, { label: '6 months', months: 6 }, { label: '12 months', months: 12 }].map(p => {
              const val = p.months === 0 ? '' : deadlinePreset(p.months)
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDeadline(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    deadline === val
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <input
            name="deadline"
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 font-semibold">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-black text-white font-bold rounded-xl py-3 text-sm hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create Goal'}
        </button>
      </form>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GoalsPageClient({
  goals,
  availableExercises,
  currentBodyWeight,
  newlyAchievedIds,
}: Props) {
  const [showForm, setShowForm]           = useState(false)
  const [isPending, startTransition]      = useTransition()
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [celebrating, setCelebrating]     = useState(newlyAchievedIds.length > 0)

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      await deleteGoal(id)
      setDeletingId(null)
    })
  }

  const activeGoals    = goals.filter(g => !g.achieved_at)
  const completedGoals = goals.filter(g => !!g.achieved_at)
  const celebGoals     = goals.filter(g => newlyAchievedIds.includes(g.id))

  return (
    <>
      {/* Achievement celebration */}
      {celebrating && celebGoals.length > 0 && (
        <AchievementCelebration
          goals={celebGoals}
          onDone={() => setCelebrating(false)}
        />
      )}

      <div className="space-y-4">
        {/* Add goal button */}
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full bg-black text-white font-bold rounded-xl py-3 text-sm hover:bg-gray-800 active:scale-[0.98] transition-all shadow-sm"
          >
            + New Goal
          </button>
        )}

        {/* Add goal form */}
        {showForm && (
          <AddGoalForm
            availableExercises={availableExercises}
            currentBodyWeight={currentBodyWeight}
            onDone={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Empty state */}
        {goals.length === 0 && !showForm && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-sm font-semibold">No goals yet</p>
            <p className="text-xs mt-1">Set a target and watch your progress build.</p>
          </div>
        )}

        {/* Active goals */}
        {activeGoals.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              Active · {activeGoals.length}
            </p>
            <div className="space-y-3">
              {activeGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onDelete={() => handleDelete(goal.id)}
                  isDeleting={isPending && deletingId === goal.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed goals */}
        {completedGoals.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              Completed · {completedGoals.length}
            </p>
            <div className="space-y-3">
              {completedGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onDelete={() => handleDelete(goal.id)}
                  isDeleting={isPending && deletingId === goal.id}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
