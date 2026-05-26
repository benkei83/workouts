export const MUSCLE_GROUPS = [
  { id: 'chest',     label: 'Chest' },
  { id: 'back',      label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms',      label: 'Arms' },
  { id: 'legs',      label: 'Legs' },
  { id: 'core',      label: 'Core' },
  { id: 'calves',    label: 'Calves' },
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]['id']

/** wger category name → our muscle_group slug */
export const WGER_CATEGORY_MAP: Record<string, string> = {
  'Abs':       'core',
  'Arms':      'arms',
  'Back':      'back',
  'Calves':    'calves',
  'Chest':     'chest',
  'Legs':      'legs',
  'Shoulders': 'shoulders',
}

/** wger equipment name → our equipment slug */
export const WGER_EQUIPMENT_MAP: Record<string, string> = {
  'Barbell':                    'barbell',
  'SZ-Bar':                     'barbell',
  'Dumbbell':                   'dumbbell',
  'Gym mat':                    'bodyweight',
  'Swiss ball':                 'other',
  'Pull-up bar':                'bodyweight',
  'Cable':                      'cable',
  'Machine':                    'machine',
  'Bench':                      'other',
  'None (Bodyweight exercise)': 'bodyweight',
  'Bands':                      'bands',
  'Foam roll':                  'other',
  'Kettlebell':                 'kettlebell',
}

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell:    'Barbell',
  dumbbell:   'Dumbbell',
  cable:      'Cable',
  machine:    'Machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  bands:      'Bands',
  other:      'Other',
}
