export type UserSettings = {
  screen_name: string | null
  show_trophy_toasts: boolean
  /** null = count-up mode; a positive integer = countdown from N seconds */
  rest_timer_default_secs: number | null
  vibrate_on_rest_complete: boolean
  /** Play an audio beep when the rest countdown reaches zero */
  sound_on_rest_complete: boolean
  /** Automatically post a workout summary to the community feed when finishing */
  auto_share_workouts: boolean
  /** Height in centimetres — used for BMI and Wilks score on the weight tracker */
  height_cm: number | null
  /**
   * When set, the home screen shows a focused single-exercise dashboard instead
   * of the full interface. Clear to restore normal access. UUID of the exercise.
   */
  focus_exercise_id: string | null
  /** Default number of sets pre-filled when adding a new exercise (overridden by per-exercise target_sets) */
  default_sets: number
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  screen_name: null,
  show_trophy_toasts: true,
  rest_timer_default_secs: 120,   // 2 min countdown
  vibrate_on_rest_complete: true,
  sound_on_rest_complete: true,
  auto_share_workouts: true,
  height_cm: null,
  focus_exercise_id: null,
  default_sets: 5,
}
