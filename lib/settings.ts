export type UserSettings = {
  screen_name: string | null
  show_trophy_toasts: boolean
  /** null = count-up mode; a positive integer = countdown from N seconds */
  rest_timer_default_secs: number | null
  vibrate_on_rest_complete: boolean
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  screen_name: null,
  show_trophy_toasts: true,
  rest_timer_default_secs: 120,   // 2 min countdown
  vibrate_on_rest_complete: true,
}
