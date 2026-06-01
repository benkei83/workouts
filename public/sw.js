// Yeah Buddy — Service Worker
// Strategy:
//   Static assets (.js/.css/fonts/images) → cache-first
//   Pages / navigation               → network-first, fall back to /offline
//   Supabase / API requests          → network-only (data must be fresh)

const CACHE = 'yeah-buddy-v1'
const OFFLINE_URL = '/offline'

// ── Install: pre-cache the offline page ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests
  if (request.method !== 'GET') return

  // Skip Supabase, auth, and other external API calls — always network
  if (
    url.hostname.includes('supabase') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/')
  ) return

  // Static assets → cache-first (they have content-hashed filenames)
  if (url.pathname.match(/\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Navigation (page loads) → network-first, fall back to offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful page responses for future offline fallback
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch { data = {} }

  const title   = data.title || 'Yeah Buddy'
  const options = {
    body:  data.body  || '',
    icon:  '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data:  { url: data.url || '/' },
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click → open / focus the right page ─────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If a window with that URL is already open, focus it
        for (const client of clientList) {
          if (client.url.endsWith(url) && 'focus' in client) {
            return client.focus()
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})
