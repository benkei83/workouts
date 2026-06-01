'use client'

import { useState } from 'react'
import Link from 'next/link'
import ComposeModal from './ComposeModal'

export default function MessagesHeader() {
  const [composing, setComposing] = useState(false)

  return (
    <>
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500">
          ←
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight flex-1">Messages</h1>
        <button
          onClick={() => setComposing(true)}
          className="w-10 h-10 flex items-center justify-center bg-black hover:bg-gray-800 rounded-full transition-colors text-white font-bold text-xl"
          title="New message"
        >
          ✏️
        </button>
      </header>

      {composing && <ComposeModal onClose={() => setComposing(false)} />}
    </>
  )
}
