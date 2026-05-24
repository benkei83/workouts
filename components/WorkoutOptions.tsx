'use client'

import { useState } from 'react'
import { deleteWorkout, renameWorkout } from '@/app/workout/actions'

export default function WorkoutOptions({ 
  workoutId, 
  currentTitle 
}: { 
  workoutId: string, 
  currentTitle: string 
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleRename = async () => {
    const newTitle = window.prompt('Enter new workout title:', currentTitle)
    if (newTitle && newTitle.trim() !== '' && newTitle !== currentTitle) {
      await renameWorkout(workoutId, newTitle.trim())
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this entire workout? This cannot be undone.')
    if (confirmed) {
      setIsDeleting(true)
      await deleteWorkout(workoutId)
    }
  }

  return (
    <div className="flex gap-2">
      <button 
        onClick={handleRename}
        className="text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
      >
        Rename
      </button>
      <button 
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {isDeleting ? '...' : 'Delete'}
      </button>
    </div>
  )
}