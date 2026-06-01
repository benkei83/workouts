import webpush from 'web-push'
import { createAdminClient } from './supabase/admin'

export interface PushPayload {
  title: string
  body: string
  url?: string
}

/**
 * Send a push notification to all registered devices for a given user.
 * Automatically removes stale subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  // Initialise lazily so this never runs during the Next.js build
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const supabase = createAdminClient()

  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (subErr) { console.error('[push] failed to fetch subscriptions:', subErr); return }
  if (!subs?.length) { console.log('[push] no subscriptions for user', userId); return }

  const message = JSON.stringify(payload)

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
      )
    )
  )

  // Clean up subscriptions the push service no longer recognises
  const staleEndpoints: string[] = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        staleEndpoints.push(subs[i].endpoint)
      }
    }
  })

  if (staleEndpoints.length) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints)
  }
}
