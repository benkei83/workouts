'use client'

export default function OfflinePage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">🏋️</div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">You're offline</h1>
      <p className="text-gray-500 text-sm mb-8">
        Looks like the Wi-Fi skipped leg day. Check your connection and try again.
      </p>
      <button
        onClick={() => { window.location.href = '/' }}
        className="bg-black text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-800 active:scale-95 transition-all"
      >
        Try again
      </button>
    </main>
  )
}
