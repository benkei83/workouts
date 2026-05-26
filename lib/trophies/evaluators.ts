import type { EvalContext } from './types'

/** Each evaluator is a pure function: EvalContext → number.
 *  The engine compares the returned number against each tier's threshold.
 *  Special cases are documented inline. */
export type EvaluatorFn = (ctx: EvalContext) => number

// ─── Simple field passthrough evaluators ────────────────────────────────────

const maxSessionTonnage:       EvaluatorFn = ctx => ctx.maxSessionTonnage
const lifetimeTonnage:         EvaluatorFn = ctx => ctx.lifetimeTonnage
const totalWorkoutMins:        EvaluatorFn = ctx => ctx.totalWorkoutMins
const highRpeSets:             EvaluatorFn = ctx => ctx.highRpeSets
const bestFiveByFiveWeight:    EvaluatorFn = ctx => ctx.bestFiveByFiveWeight
const autoProgressionCount:    EvaluatorFn = ctx => ctx.autoProgressionCount
const trueOnermSets:           EvaluatorFn = ctx => ctx.trueOnermSets
const perfectSessionCount:     EvaluatorFn = ctx => ctx.perfectSessionCount
const deloadRecoveryCount:     EvaluatorFn = ctx => ctx.deloadRecoveryCount
const totalWorkouts:           EvaluatorFn = ctx => ctx.totalWorkouts
const maxExerciseSessionCount: EvaluatorFn = ctx => ctx.maxExerciseSessionCount
const consecutiveWeeks3x:      EvaluatorFn = ctx => ctx.consecutiveWeeks3x
const longestEverStreakDays:   EvaluatorFn = ctx => ctx.longestEverStreakDays
const maxWorkoutGapDays:       EvaluatorFn = ctx => ctx.maxWorkoutGapDays
const bestCardioSpeed:         EvaluatorFn = ctx => ctx.bestCardioSpeed
const maxSpeedImprovementPct:  EvaluatorFn = ctx => ctx.maxSpeedImprovementPct
const totalKmRun:              EvaluatorFn = ctx => ctx.totalKmRun
const exerciseVarietyCount:    EvaluatorFn = ctx => ctx.exerciseVarietyCount
const perfectSupersetCount:    EvaluatorFn = ctx => ctx.perfectSupersetCount
const doubleProgressionCount:  EvaluatorFn = ctx => ctx.doubleProgressionCount
const maxFailureStreakBroken:  EvaluatorFn = ctx => ctx.maxFailureStreakBroken
const longestSessionMins:      EvaluatorFn = ctx => ctx.longestSessionMins

// ─── Special evaluators ──────────────────────────────────────────────────────

/**
 * modulesUsed — returns a value 0–4 representing breadth of training modalities.
 *   1  any module used at all
 *   2  two or more distinct modalities used across all history
 *   3  all three modalities used (cardio, strength, superset) at some point
 *   4  all three used in a SINGLE workout (allThreeInOneSession)
 *
 * Tiers in the registry use thresholds 1/2/3/4 so the engine can compare directly.
 */
const modulesUsed: EvaluatorFn = ctx => {
  if (ctx.allThreeInOneSession) return 4

  const count = [ctx.hasLoggedCardio, ctx.hasLoggedStrength, ctx.hasLoggedSuperset]
    .filter(Boolean).length

  return count // 0, 1, 2, or 3
}

/**
 * started — sequential onboarding milestones.  Returns a 0–4 score where
 * each milestone gate must be passed in order (it's not possible to skip one):
 *   0  no workouts at all
 *   1  has completed at least one workout
 *   2  has at least one PR logged
 *   3  has used auto-progression at least once
 *   4  has logged at least one true 1-rep-max set
 *
 * Registry tiers use thresholds 1/2/3/4 so the engine compares directly.
 */
const started: EvaluatorFn = ctx => {
  if (ctx.totalWorkouts === 0)       return 0
  if (ctx.totalPrCount === 0)        return 1
  if (ctx.autoProgressionCount === 0) return 2
  if (ctx.trueOnermSets === 0)       return 3
  return 4
}

// ─── Registry map ────────────────────────────────────────────────────────────

export const EVALUATORS: Record<string, EvaluatorFn> = {
  maxSessionTonnage,
  lifetimeTonnage,
  totalWorkoutMins,
  highRpeSets,
  bestFiveByFiveWeight,
  autoProgressionCount,
  trueOnermSets,
  perfectSessionCount,
  deloadRecoveryCount,
  totalWorkouts,
  maxExerciseSessionCount,
  consecutiveWeeks3x,
  longestEverStreakDays,
  maxWorkoutGapDays,
  bestCardioSpeed,
  maxSpeedImprovementPct,
  totalKmRun,
  exerciseVarietyCount,
  modulesUsed,
  perfectSupersetCount,
  doubleProgressionCount,
  maxFailureStreakBroken,
  longestSessionMins,
  started,
}
