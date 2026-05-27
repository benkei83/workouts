'use client'

import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'yeah-buddy-install-dismissed'

export default function IOSInstallPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only fire on iOS Safari, not when already installed as a PWA
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isInstalled =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches

    if (!isIOS || isInstalled) return

    try {
      if (localStorage.getItem(DISMISSED_KEY)) return
    } catch { /* storage blocked */ }

    // Delay 4 s so the user has a moment to orient themselves first
    const t = setTimeout(() => setShow(true), 4000)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* ignore */ }
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50"
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          {/* Mini barbell icon */}
          <div
            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: '#18181b' }}
          >
            <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
              {/* left plate */}
              <rect x="2"  y="10" width="7" height="28" rx="2" fill="#f97316" />
              {/* left sleeve */}
              <rect x="9"  y="18" width="5" height="12" fill="#71717a" />
              {/* bar */}
              <rect x="14" y="21" width="20" height="6"  rx="1" fill="#e4e4e7" />
              {/* right sleeve */}
              <rect x="34" y="18" width="5" height="12" fill="#71717a" />
              {/* right plate */}
              <rect x="39" y="10" width="7" height="28" rx="2" fill="#f97316" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-gray-900">Add Yeah Buddy to your home screen</p>
            <p className="text-xs text-gray-500 mt-1 leading-snug">
              Tap the{' '}
              <span className="font-semibold">Share</span>{' '}
              <span className="text-base leading-none">⎋</span>{' '}
              button at the bottom of Safari, then tap{' '}
              <span className="font-semibold">"Add to Home Screen"</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 text-gray-400 hover:text-gray-600 font-bold text-sm p-1 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>

        {/* Arrow pointing to the Share button location */}
        <div className="flex justify-center mt-3">
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <div className="w-px h-4 bg-gray-200" />
            <span className="text-xl">▾</span>
          </div>
        </div>
      </div>
    </div>
  )
}
