'use client'

import { useState, useTransition } from 'react'
import { shareWorkoutToFeed, unshareWorkoutFromFeed } from '@/app/workout/actions'

export default function ShareWorkoutButton({
  workoutId,
  feedPostId,
  feedPostVisible,
}: {
  workoutId:       string
  feedPostId:      string | null
  feedPostVisible: boolean
}) {
  const [postId, setPostId]   = useState(feedPostId)
  const [visible, setVisible] = useState(feedPostVisible)
  const [isPending, start]    = useTransition()

  const isShared = postId !== null && visible

  const handleShare = () => {
    start(async () => {
      const result = await shareWorkoutToFeed(workoutId)
      if ('ok' in result) {
        setPostId(result.postId)
        setVisible(true)
      }
    })
  }

  const handleUnshare = () => {
    if (!postId) return
    start(async () => {
      await unshareWorkoutFromFeed(postId, workoutId)
      setVisible(false)
    })
  }

  if (isShared) {
    return (
      <button
        onClick={handleUnshare}
        disabled={isPending}
        className="text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        title="Remove from community feed"
      >
        {isPending ? '…' : '✓ In feed'}
      </button>
    )
  }

  return (
    <button
      onClick={handleShare}
      disabled={isPending}
      className="text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      title="Share this workout to the community feed"
    >
      {isPending ? '…' : '📤 Share'}
    </button>
  )
}
