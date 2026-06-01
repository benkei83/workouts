'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { searchUsers, sendMessage, fetchUserProgramNames } from '@/app/inbox/actions'

type UserResult = { user_id: string; screen_name: string | null }
type Program = { id: string; name: string; share_token: string | null }

export default function ComposeModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<UserResult[]>([])
  const [noResults, setNoResults]   = useState(false)
  const [recipient, setRecipient]   = useState<UserResult | null>(null)
  const [body, setBody]             = useState('')
  const [programs, setPrograms]     = useState<Program[]>([])
  const [selectedProg, setSelectedProg] = useState<Program | null>(null)
  const [showPrograms, setShowPrograms] = useState(false)
  const [searching, startSearch]    = useTransition()
  const [sending, startSend]        = useTransition()
  const [error, setError]           = useState<string | null>(null)
  const router = useRouter()

  // Load user's programs once
  useEffect(() => {
    fetchUserProgramNames().then(setPrograms)
  }, [])

  const handleSearch = (q: string) => {
    setQuery(q)
    setRecipient(null)
    setNoResults(false)
    if (!q.trim()) { setResults([]); return }
    startSearch(async () => {
      const res = await searchUsers(q)
      setResults(res)
      setNoResults(res.length === 0)
    })
  }

  const handleSend = () => {
    if (!recipient || (!body.trim() && !selectedProg)) return
    setError(null)
    startSend(async () => {
      const res = await sendMessage({
        recipientId: recipient.user_id,
        body: body.trim(),
        programId: selectedProg?.id ?? null,
      })
      if (res?.error) { setError(res.error); return }
      onClose()
      router.push(`/inbox/${recipient.user_id}`)
    })
  }

  const displayName = (u: UserResult) => u.screen_name?.trim() || `User ${u.user_id.slice(0, 6)}`

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">New Message</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold p-2">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* Recipient search */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">To</label>
            {recipient ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <span className="font-bold text-sm text-blue-800">{displayName(recipient)}</span>
                <button
                  onClick={() => { setRecipient(null); setQuery('') }}
                  className="ml-auto text-blue-400 hover:text-blue-700 font-bold"
                >✕</button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search by name…"
                    autoFocus
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black"
                  />
                  {searching && (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />
                  )}
                </div>

                {/* Results rendered in-flow — no absolute positioning so overflow-y-auto won't clip them */}
                {results.length > 0 && (
                  <div className="mt-1.5 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {results.map(u => (
                      <button
                        key={u.user_id}
                        onClick={() => { setRecipient(u); setResults([]); setNoResults(false) }}
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        {displayName(u)}
                      </button>
                    ))}
                  </div>
                )}
                {noResults && query.trim() && !searching && (
                  <p className="text-xs text-gray-400 mt-1.5 px-1">No users found for "{query}"</p>
                )}
              </div>
            )}
          </div>

          {/* Message body */}
          {recipient && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Message</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write something…"
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>

              {/* Optional program attachment */}
              {programs.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowPrograms(p => !p)}
                    className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    📋 {selectedProg ? `Program: ${selectedProg.name}` : 'Attach a program'} {showPrograms ? '▲' : '▼'}
                  </button>

                  {showPrograms && (
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                      {selectedProg && (
                        <button
                          onClick={() => { setSelectedProg(null); setShowPrograms(false) }}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 border-b border-gray-100 transition-colors"
                        >
                          ✕ Remove attachment
                        </button>
                      )}
                      {programs.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedProg(p); setShowPrograms(false) }}
                          className={`w-full text-left px-4 py-2.5 text-sm font-semibold border-b border-gray-100 last:border-0 transition-colors ${
                            selectedProg?.id === p.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedProg && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                  <span>📋</span>
                  <span className="text-sm font-semibold text-blue-800">{selectedProg.name}</span>
                </div>
              )}

              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            </>
          )}
        </div>

        {/* Send button */}
        {recipient && (
          <div className="px-6 pb-6 pt-2 flex-shrink-0 border-t border-gray-100">
            <button
              onClick={handleSend}
              disabled={sending || (!body.trim() && !selectedProg)}
              className="w-full bg-black text-white font-bold rounded-xl py-3.5 disabled:opacity-40 hover:bg-gray-800 active:scale-[0.98] transition-all"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
