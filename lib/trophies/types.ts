export type TierLevel = 1 | 2 | 3 | 4

export type TrophyTier = {
  level: TierLevel
  label: 'Bronze' | 'Silver' | 'Gold' | 'Diamond'
  emoji: '🥉' | '🥈' | '🥇' | '💎'
  threshold: number
  description: string
}

export type TrophyCategory =
  | 'volume'
  | 'strength'
  | 'consistency'
  | 'cardio'
  | 'mastery'
  | 'grit'

export const CATEGORY_LABELS: Record<TrophyCategory, string> = {
  volume:      'Volume',
  strength:    'Strength',
  consistency: 'Consistency',
  cardio:      'Cardio',
  mastery:     'Mastery',
  grit:        'Grit',
}

export const CATEGORY_EMOJI: Record<TrophyCategory, string> = {
  volume:      '🏋️',
  strength:    '💪',
  consistency: '🗓️',
  cardio:      '🏃',
  mastery:     '🎓',
  grit:        '⚡',
}

export type Trophy = {
  id: string
  quote: string
  attribution?: string
  category: TrophyCategory
  /** Key into EVALUATORS map in evaluators.ts */
  evaluator: string
  tiers: [TrophyTier, TrophyTier, TrophyTier, TrophyTier]
}

export type TrophyUnlock = {
  trophy: Trophy
  tier: TierLevel
  tierLabel: string
  tierEmoji: string
  context: Record<string, unknown>
}

/** Full statistical snapshot built once per evaluation run */
export type EvalContext = {
  userId: string
  workoutId: string
  // Workout counts / time
  totalWorkouts: number
  totalWorkoutMins: number
  longestSessionMins: number
  maxWorkoutGapDays: number
  longestEverStreakDays: number
  consecutiveWeeks3x: number
  // Volume
  lifetimeTonnage: number
  maxSessionTonnage: number
  // Strength sets
  trueOnermSets: number     // actual_reps === 1
  highRpeSets: number       // rpe 9 or 10 (not cheated)
  totalPrCount: number      // is_pr = true
  bestFiveByFiveWeight: number
  exerciseVarietyCount: number
  maxExerciseSessionCount: number
  // Cardio
  totalKmRun: number
  bestCardioSpeed: number
  maxSpeedImprovementPct: number
  // Module usage
  hasLoggedCardio: boolean
  hasLoggedStrength: boolean
  hasLoggedSuperset: boolean
  allThreeInOneSession: boolean
  // Event-tracked (settings history + user_trophy_events)
  autoProgressionCount: number
  doubleProgressionCount: number
  perfectSessionCount: number
  maxFailureStreakBroken: number
  deloadRecoveryCount: number
  perfectSupersetCount: number
}
