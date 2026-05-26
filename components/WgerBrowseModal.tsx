'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { fetchAllWgerExercises, addWgerExercise } from '@/app/workout/actions'
import { MUSCLE_GROUPS, EQUIPMENT_LABELS } from '@/lib/muscleGroups'

export type WgerItem = { name: string; muscle_group: string | null; equipment: string | null }

const MG_LABELS: Record<string, string> = Object.fromEntries(MUSCLE_GROUPS.map(g => [g.id, g.label]))
const MG_COLORS: Record<string, string> = {
  chest:     'bg-red-50 text-red-600 border-red-100',
  back:      'bg-blue-50 text-blue-600 border-blue-100',
  shoulders: 'bg-purple-50 text-purple-600 border-purple-100',
  arms:      'bg-orange-50 text-orange-600 border-orange-100',
  legs:      'bg-green-50 text-green-600 border-green-100',
  core:      'bg-yellow-50 text-yellow-700 border-yellow-100',
  calves:    'bg-teal-50 text-teal-600 border-teal-100',
}

function MgChip({ id }: { id: string | null }) {
  if (!id || !MG_LABELS[id]) return null
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${MG_COLORS[id] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
      {MG_LABELS[id]}
    </span>
  )
}
function EqChip({ id }: { id: string | null }) {
  if (!id || !EQUIPMENT_LABELS[id]) return null
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
      {EQUIPMENT_LABELS[id]}
    </span>
  )
}

type Props = {
  /** Names already in the user's library (lowercase). Used to show ✓ vs + Add. */
  libraryNames: Set<string>
  onClose: () => void
  /** Called after a new exercise is added to DB (not called for already-in-library items). */
  onAdded?: (item: WgerItem, id: string) => void
}

export default function WgerBrowseModal({ libraryNames, onClose, onAdded }: Props) {
  const [wgerAll, setWgerAll] = useState<WgerItem[]>([])
  const [wgerLoaded, setWgerLoaded] = useState(false)
  const [wgerError, setWgerError] = useState(false)
  const [browseSearch, setBrowseSearch] = useState('')
  const [browseMuscle, setBrowseMuscle] = useState<string | null>(null)
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set())
  const [addError, setAddError] = useState<string | null>(null)

  const [isLoading, startLoad] = useTransition()
  const [isAdding, startAdd] = useTransition()

  // Kick off the catalogue fetch once on mount
  useEffect(() => {
    startLoad(async () => {
      try {
        const all = await fetchAllWgerExercises()
        setWgerAll(all)
        setWgerLoaded(true)
      } catch {
        setWgerError(true)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => wgerAll.filter(ex => {
    if (browseSearch && !ex.name.toLowerCase().includes(browseSearch.toLowerCase())) return false
    if (browseMuscle && ex.muscle_group !== browseMuscle) return false
    return true
  }), [wgerAll, browseSearch, browseMuscle])

  const handleAdd = (item: WgerItem) => {
    setAddError(null)
    startAdd(async () => {
      const res = await addWgerExercise(item.name, item.muscle_group, item.equipment)
      if ('error' in res) { setAddError(`Failed: ${res.error}`); return }
      setAddedNames(prev => new Set(prev).add(item.name.toLowerCase()))
      if (!res.existed) onAdded?.(item, res.id)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Browse wger Exercises</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {wgerLoaded
                  ? `${filtered.length} of ${wgerAll.length} exercises`
                  : isLoading ? 'Loading catalogue…' : 'Ready'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 font-bold p-1">✕</button>
          </div>

          <input
            type="text"
            placeholder="Filter by name…"
            value={browseSearch}
            onChange={e => setBrowseSearch(e.target.value)}
            disabled={!wgerLoaded}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-black disabled:opacity-40"
            autoFocus
          />

          <div className="flex gap-1.5 flex-wrap mt-2.5">
            {[{ id: null, label: 'All' }, ...MUSCLE_GROUPS].map(g => (
              <button
                key={g.id ?? 'all'}
                onClick={() => setBrowseMuscle(g.id)}
                disabled={!wgerLoaded}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                  browseMuscle === g.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 py-2">
          {addError && <p className="text-xs text-red-500 font-medium py-2">{addError}</p>}

          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400 font-medium">Loading…</span>
            </div>
          )}

          {wgerError && (
            <p className="text-center text-red-400 text-sm py-8">Failed to load. Check your connection.</p>
          )}

          {wgerLoaded && filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No exercises match.</p>
          )}

          {wgerLoaded && filtered.map(item => {
            const inLib = libraryNames.has(item.name.toLowerCase()) || addedNames.has(item.name.toLowerCase())
            return (
              <div key={item.name} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug ${inLib ? 'text-gray-400' : 'text-gray-900'}`}>
                    {item.name}
                  </p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    <MgChip id={item.muscle_group} />
                    <EqChip id={item.equipment} />
                  </div>
                </div>
                {inLib ? (
                  <span className="flex-shrink-0 text-xs font-bold text-green-500 px-2">✓</span>
                ) : (
                  <button
                    onClick={() => handleAdd(item)}
                    disabled={isAdding}
                    className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    + Add
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
