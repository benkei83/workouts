import type { Trophy } from './types'

export const TROPHY_REGISTRY: Trophy[] = [

  // ══════════════════════════════════════════════════════════════
  // VOLUME
  // ══════════════════════════════════════════════════════════════

  {
    id: 'yeah_buddy',
    quote: 'Yeah Buddy!',
    attribution: '— Ronnie Coleman',
    category: 'volume',
    evaluator: 'maxSessionTonnage',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 2_000,  description: 'Reach 2,000 kg tonnage in a single session' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 5_000,  description: 'Reach 5,000 kg tonnage in a single session' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 10_000, description: 'Reach 10,000 kg tonnage in a single session' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 20_000, description: 'Reach 20,000 kg tonnage in a single session' },
    ],
  },

  {
    id: 'bodybuilder',
    quote: "Everybody wants to be a bodybuilder, but nobody wants to lift this heavy-ass weight.",
    attribution: '— Ronnie Coleman',
    category: 'volume',
    evaluator: 'lifetimeTonnage',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 50_000,    description: 'Lift 50,000 kg across all sessions' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 250_000,   description: 'Lift 250,000 kg total' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 750_000,   description: 'Lift 750,000 kg total' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 2_000_000, description: 'Lift 2,000,000 kg total' },
    ],
  },

  {
    id: 'blood_sweat',
    quote: 'Blood, sweat and respect. First two you give, last one you earn.',
    attribution: '— Dwayne Johnson',
    category: 'volume',
    evaluator: 'totalWorkoutMins',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 500,   description: '500 total minutes of training' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 2_000, description: '2,000 total minutes of training' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 5_000, description: '5,000 total minutes of training' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 15_000, description: '15,000 total minutes — the long game' },
    ],
  },

  {
    id: 'reps_that_count',
    quote: 'The last three or four reps is what makes the muscle grow. This area of pain divides the champion from someone who is not a champion.',
    attribution: '— Arnold Schwarzenegger',
    category: 'volume',
    evaluator: 'highRpeSets',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 10,  description: '10 sets logged at RPE 9–10' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 50,  description: '50 sets at RPE 9–10' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 150, description: '150 sets at RPE 9–10' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 500, description: '500 sets at RPE 9–10' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // STRENGTH
  // ══════════════════════════════════════════════════════════════

  {
    id: 'peanut',
    quote: "Ain't nothin' but a peanut.",
    attribution: '— Ronnie Coleman',
    category: 'strength',
    evaluator: 'bestFiveByFiveWeight',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 100, description: 'Complete a 5×5 at 100 kg on any exercise' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 140, description: 'Complete a 5×5 at 140 kg' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 180, description: 'Complete a 5×5 at 180 kg' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 220, description: 'Complete a 5×5 at 220 kg' },
    ],
  },

  {
    id: 'light_weight',
    quote: 'Light weight, baby!',
    attribution: '— Ronnie Coleman',
    category: 'strength',
    evaluator: 'autoProgressionCount',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1,  description: 'First automatic weight progression' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 10, description: '10 automatic weight progressions' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 30, description: '30 automatic weight progressions' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 75, description: '75 automatic weight progressions' },
    ],
  },

  {
    id: 'bleed',
    quote: 'Time to bleed.',
    attribution: '— Ronnie Coleman',
    category: 'strength',
    evaluator: 'trueOnermSets',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1,  description: 'Log your first true 1RM (single rep)' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 5,  description: '5 true 1RM sets' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 15, description: '15 true 1RM sets' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 40, description: '40 true 1RM sets' },
    ],
  },

  {
    id: 'first_place',
    quote: 'There is no room for second place. There is only one place in my game and that is first place.',
    attribution: '— Arnold Schwarzenegger',
    category: 'strength',
    evaluator: 'perfectSessionCount',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1,  description: 'Complete a perfect session — every planned set hit' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 5,  description: '5 perfect sessions' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 15, description: '15 perfect sessions' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 40, description: '40 perfect sessions' },
    ],
  },

  {
    id: 'mightier',
    quote: 'That which does not kill me makes me stronger.',
    attribution: '— Friedrich Nietzsche',
    category: 'strength',
    evaluator: 'deloadRecoveryCount',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1,  description: 'Succeed on a lift after a deload' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 5,  description: '5 deload recoveries' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 15, description: '15 deload recoveries' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 30, description: '30 deload recoveries' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // CONSISTENCY
  // ══════════════════════════════════════════════════════════════

  {
    id: 'iron_never_lies',
    quote: 'The iron never lies to you.',
    attribution: '— Henry Rollins',
    category: 'consistency',
    evaluator: 'totalWorkouts',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 50,   description: '50 completed workouts' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 150,  description: '150 completed workouts' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 365,  description: '365 completed workouts' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 1000, description: '1,000 completed workouts' },
    ],
  },

  {
    id: 'excellent_habit',
    quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    attribution: '— Aristotle (via Will Durant)',
    category: 'consistency',
    evaluator: 'maxExerciseSessionCount',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 20,  description: 'Log the same exercise across 20 different sessions' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 50,  description: '50 sessions with the same exercise' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 100, description: '100 sessions with the same exercise' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 250, description: '250 sessions — true mastery of a movement' },
    ],
  },

  {
    id: 'resistance',
    quote: 'The resistance that you fight physically in the gym and the resistance that you fight in life can only build a strong character.',
    attribution: '— Arnold Schwarzenegger',
    category: 'consistency',
    evaluator: 'consecutiveWeeks3x',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 4,  description: '4 consecutive weeks with 3+ sessions each' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 8,  description: '8 consecutive weeks' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 16, description: '16 consecutive weeks' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 26, description: '26 weeks — half a year of consistency' },
    ],
  },

  {
    id: 'pain_temporary',
    quote: 'Pain is temporary. Quitting lasts forever.',
    attribution: '— Lance Armstrong',
    category: 'consistency',
    evaluator: 'longestEverStreakDays',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 3,  description: '3-day training streak' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 7,  description: '7-day training streak' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 14, description: '14-day training streak' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 30, description: '30-day training streak' },
    ],
  },

  {
    id: 'champion',
    quote: 'Champions are made in the moments when they want to quit.',
    attribution: '— Gym Lore',
    category: 'consistency',
    evaluator: 'maxWorkoutGapDays',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 14,  description: 'Return to training after a 2-week break' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 30,  description: 'Return after a 1-month break' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 90,  description: 'Return after a 3-month break' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 180, description: 'Return after a 6-month break' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // CARDIO
  // ══════════════════════════════════════════════════════════════

  {
    id: 'clear_mind',
    quote: "Clear your mind of can't.",
    attribution: '— Samuel Johnson',
    category: 'cardio',
    evaluator: 'bestCardioSpeed',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 10, description: 'Sustain a cardio session at 10 km/h average' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 12, description: 'Sustain 12 km/h' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 14, description: 'Sustain 14 km/h' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 16, description: 'Sustain 16 km/h' },
    ],
  },

  {
    id: 'goes_faster',
    quote: "It never gets easier, you just go faster.",
    attribution: '— Greg LeMond',
    category: 'cardio',
    evaluator: 'maxSpeedImprovementPct',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1,  description: 'Beat your previous best speed in any cardio session' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 5,  description: 'Beat your previous best speed by 5%' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 10, description: 'Beat your previous best speed by 10%' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 20, description: 'Beat your previous best speed by 20%' },
    ],
  },

  {
    id: 'big_dogs',
    quote: "If you want to run with the big dogs, you can't pee like a puppy.",
    attribution: '— Gym Lore',
    category: 'cardio',
    evaluator: 'totalKmRun',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 42.195, description: "A marathon's worth of total distance — 42.195 km" },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 100,    description: '100 km total' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 500,    description: '500 km total' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 1000,   description: '1,000 km total' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // MASTERY
  // ══════════════════════════════════════════════════════════════

  {
    id: 'shame_to_grow_old',
    quote: 'It is a shame for a man to grow old without seeing the beauty and strength of which his body is capable.',
    attribution: '— Socrates',
    category: 'mastery',
    evaluator: 'exerciseVarietyCount',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 5,  description: 'Log 5 distinct exercises' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 15, description: 'Log 15 distinct exercises' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 30, description: 'Log 30 distinct exercises' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 50, description: 'Log 50 distinct exercises' },
    ],
  },

  {
    id: 'no_amateur',
    quote: 'No citizen has a right to be an amateur in the matter of physical training.',
    attribution: '— Socrates',
    category: 'mastery',
    evaluator: 'modulesUsed',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1, description: 'Use your first training module' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 2, description: 'Train in 2 different modalities' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 3, description: 'Train in all 3 modalities (cardio, strength, superset)' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 4, description: 'Complete all 3 modalities in a single workout' },
    ],
  },

  {
    id: 'conquers_himself',
    quote: 'He who conquers himself is the mightiest warrior.',
    attribution: '— Lao Tzu',
    category: 'mastery',
    evaluator: 'perfectSupersetCount',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1,  description: 'Complete a perfect superset' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 5,  description: '5 perfect supersets' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 15, description: '15 perfect supersets' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 30, description: '30 perfect supersets' },
    ],
  },

  {
    id: 'double_habit',
    quote: 'Discipline is the bridge between goals and accomplishment.',
    attribution: '— Jim Rohn',
    category: 'mastery',
    evaluator: 'doubleProgressionCount',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1,  description: 'Trigger your first Double Progression weight increase' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 5,  description: '5 Double Progression increases' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 15, description: '15 Double Progression increases' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 30, description: '30 Double Progression increases' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // GRIT
  // ══════════════════════════════════════════════════════════════

  {
    id: 'nerves_steel',
    quote: 'Nerves of steel.',
    attribution: '— Tom Platz',
    category: 'grit',
    evaluator: 'maxFailureStreakBroken',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1, description: 'Break a failure streak — succeed after 1 consecutive failure' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 2, description: 'Break a 2-session failure streak' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 3, description: 'Break a 3-session failure streak' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 5, description: 'Break a 5-session failure streak' },
    ],
  },

  {
    id: 'started',
    quote: 'The secret of getting ahead is getting started.',
    attribution: '— Mark Twain',
    category: 'grit',
    // Special sequential evaluator: returns 0-4 based on onboarding milestones hit in order
    evaluator: 'started',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 1, description: 'Complete your first workout' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 2, description: 'Set your first personal record' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 3, description: 'Trigger your first automatic progression' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 4, description: 'Log your first true 1RM test' },
    ],
  },

  {
    id: 'meditation',
    quote: 'A one-hour workout is 4% of your day. No excuses.',
    attribution: '— Gym Lore',
    category: 'grit',
    evaluator: 'longestSessionMins',
    tiers: [
      { level: 1, label: 'Bronze',  emoji: '🥉', threshold: 60,  description: 'Complete a 60-minute session' },
      { level: 2, label: 'Silver',  emoji: '🥈', threshold: 90,  description: 'Complete a 90-minute session' },
      { level: 3, label: 'Gold',    emoji: '🥇', threshold: 120, description: 'Complete a 2-hour session' },
      { level: 4, label: 'Diamond', emoji: '💎', threshold: 180, description: 'Complete a 3-hour session' },
    ],
  },
]
