'use client'

import { useState, useTransition } from 'react'
import { forceEvaluateTrophies, clearTrophies } from './actions'

export function ForceEvaluateButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  const run = () => {
    startTransition(async () => {
      const res = await forceEvaluateTrophies()
      if ('error' in res) {
        setResult(`Error: ${res.error}`)
      } else {
        setResult(
          res.count === 0
            ? 'No new trophies unlocked.'
            : `Unlocked ${res.count} new tier${res.count !== 1 ? 's' : ''}:\n${res.trophies?.join('\n')}`
        )
      }
    })
  }

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Running…' : '⚡ Force Re-evaluate Trophies'}
      </button>
      {result && (
        <pre className="text-xs bg-gray-100 rounded-lg p-3 whitespace-pre-wrap text-gray-700">
          {result}
        </pre>
      )}
    </div>
  )
}

export function ClearTrophiesButton() {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const run = () => {
    startTransition(async () => {
      await clearTrophies()
      setDone(true)
      setConfirmOpen(false)
    })
  }

  if (!confirmOpen) {
    return (
      <button
        onClick={() => setConfirmOpen(true)}
        className="px-4 py-2 bg-red-100 text-red-700 text-sm font-bold rounded-lg hover:bg-red-200 transition-colors"
      >
        🗑 Clear All Trophies
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Are you sure?</span>
      <button
        onClick={run}
        disabled={isPending}
        className="px-3 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? 'Clearing…' : 'Yes, clear'}
      </button>
      <button
        onClick={() => setConfirmOpen(false)}
        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-200"
      >
        Cancel
      </button>
      {done && <span className="text-xs text-green-600 font-medium">Done ✓</span>}
    </div>
  )
}
