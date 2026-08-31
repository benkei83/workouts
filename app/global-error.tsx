'use client'

/**
 * Last-resort boundary for errors thrown in the root layout itself (which
 * app/error.tsx cannot catch, since it renders *inside* that layout).
 * Must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <main
          style={{
            maxWidth: 448,
            margin: '0 auto',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 24 }}>💥</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
            The app failed to load
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px' }}>
            Try again, or sign in if your session expired.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#000',
              color: '#fff',
              fontWeight: 700,
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              fontSize: 16,
            }}
          >
            Try again
          </button>
          <a href="/sign-in" style={{ color: '#6b7280', fontSize: 14, fontWeight: 600, marginTop: 12 }}>
            Sign in again
          </a>
          {error.digest && (
            <p style={{ color: '#d1d5db', fontSize: 10, marginTop: 32, fontFamily: 'monospace' }}>
              ref: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
