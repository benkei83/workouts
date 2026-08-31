'use client'

import { useEffect } from 'react'

/**
 * Route-level error boundary. Without this, a throw in any Server Component
 * (e.g. an AuthApiError while loading the dashboard) renders an empty document
 * — which on the installed iOS PWA looks like a plain black screen, because
 * there is no browser chrome and the theme colour is near-black.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">💥</div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Something failed a rep</h1>
      <p className="text-gray-500 text-sm mb-8">
        We hit an error loading this page. Try again, or sign in if your session expired.
      </p>
      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={reset}
          className="bg-black text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-800 active:scale-95 transition-all"
        >
          Try again
        </button>
        <a
          href="/sign-in"
          className="text-gray-500 text-sm font-semibold py-2 hover:text-gray-900 transition-colors"
        >
          Sign in again
        </a>
      </div>
      {error.digest && (
        <p className="text-gray-300 text-[10px] mt-8 font-mono">ref: {error.digest}</p>
      )}
    </main>
  )
}
