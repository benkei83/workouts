/**
 * Lightweight localStorage queue for pending workout save operations.
 * Written before the server round-trip; cleared on success.
 * Survives tab closes / crashes — surfaced as a recovery banner on next load.
 */

const QUEUE_KEY = 'fitness_engine_pending_ops'

export type PendingOp = {
  id: string
  workoutId: string
  type: 'strength' | 'superset'
  // strength
  exerciseId?: string
  sets?: { weight: number; reps: number }[]
  // superset
  matrix?: Record<string, { weight: number; reps: number }[]>
  timestamp: number
}

export function getPendingOps(): PendingOp[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as PendingOp[]) : []
  } catch {
    return []
  }
}

export function enqueuePendingOp(op: PendingOp): void {
  const ops = getPendingOps()
  ops.push(op)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
}

export function dequeuePendingOp(id: string): void {
  const ops = getPendingOps().filter(op => op.id !== id)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
}

export function clearPendingOpsForWorkout(workoutId: string): void {
  const ops = getPendingOps().filter(op => op.workoutId !== workoutId)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
}
