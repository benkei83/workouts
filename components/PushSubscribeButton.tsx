'use client'

import { useState, useEffect, useTransition } from 'react'
import { subscribeToPush, unsubscribeFromPush } from '@/app/push/actions'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

type State = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export default function PushSubscribeButton() {
  const [state, setState] = useState<State>('loading')
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setState('unsupported')
      return
    }

    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (sub) {
          setCurrentEndpoint(sub.endpoint)
          setState('subscribed')
        } else {
          setState('unsubscribed')
        }
      })
    })
  }, [])

  const handleSubscribe = () => {
    setError(null)
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setState('denied')
          return
        }

        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        })

        const json = sub.toJSON() as {
          endpoint: string
          keys: { p256dh: string; auth: string }
        }

        const res = await subscribeToPush(json)
        if (res?.error) { setError(res.error); return }

        setCurrentEndpoint(json.endpoint)
        setState('subscribed')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to subscribe')
      }
    })
  }

  const handleUnsubscribe = () => {
    if (!currentEndpoint) return
    setError(null)
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        await sub?.unsubscribe()
        await unsubscribeFromPush(currentEndpoint)
        setCurrentEndpoint(null)
        setState('unsubscribed')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to unsubscribe')
      }
    })
  }

  if (state === 'loading') return null
  if (state === 'unsupported') return null

  return (
    <div className="space-y-2">
      {state === 'denied' ? (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
          <span className="text-lg mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-yellow-800">Notifications blocked</p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Allow notifications for this site in your browser settings to enable push alerts.
            </p>
          </div>
        </div>
      ) : state === 'subscribed' ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Push notifications</span>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">On</span>
          </div>
          <button
            onClick={handleUnsubscribe}
            disabled={isPending}
            className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Turning off…' : 'Turn off'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Push notifications</p>
            <p className="text-xs text-gray-400 mt-0.5">Get notified about new messages</p>
          </div>
          <button
            onClick={handleSubscribe}
            disabled={isPending}
            className="text-sm font-bold bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Enabling…' : 'Enable'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
