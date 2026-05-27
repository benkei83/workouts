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
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  screen_name: null,
  show_trophy_toasts: true,
  rest_timer_default_secs: 120,   // 2 min countdown
  vibrate_on_rest_complete: true,
  sound_on_rest_complete: true,
  auto_share_workouts: true,
  height_cm: null,
}
