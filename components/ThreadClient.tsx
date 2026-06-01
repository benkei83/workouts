'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { sendReply } from '@/app/inbox/actions'
import { importSharedProgram } from '@/app/workout/actions'

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  body: string | null
  program_share_token: string | null
  program_name: string | null
  created_at: string
  read_at: string | null
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function ProgramCard({
  token,
  name,
  isFromMe,
}: {
  token: string
  name: string
  isFromMe: boolean
}) {
  const [importing, startImport] = useTransition()
  const [imported, setImported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleImport = () => {
    startImport(async () => {
      const res = await importSharedProgram(token)
      if (res?.error) { setError(res.error); return }
      setImported(true)
      setTimeout(() => router.push('/programs'), 1200)
    })
  }

  return (
    <div className={`mt-1.5 rounded-xl border p-3 space-y-2 ${isFromMe ? 'bg-blue-500/20 border-blue-300/40' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">📋</span>
        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase tracking-wider ${isFromMe ? 'text-blue-200' : 'text-gray-400'}`}>Program</p>
          <p className={`text-sm font-bold leading-tight ${isFromMe ? 'text-white' : 'text-gray-900'}`}>{name}</p>
        </div>
      </div>
      {!isFromMe && (
        <div className="flex gap-2">
          {imported ? (
            <span className="text-xs font-bold text-green-600">✓ Imported! Redirecting…</span>
          ) : (
            <>
              <button
                onClick={handleImport}
                disabled={importing}
                className="text-xs font-bold bg-black text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-gray-800 transition-colors"
              >
                {importing ? 'Importing…' : 'Import Program'}
              </button>
              <Link
                href={`/programs/share/${token}`}
                className="text-xs font-bold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
              >
                Preview
              </Link>
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}

export default function ThreadClient({
  messages: initialMessages,
  otherUserId,
  otherName,
  currentUserId,
}: {
  messages: Message[]
  otherUserId: string
  otherName: string
  currentUserId: string
}) {
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Scroll to bottom on load and after new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [initialMessages.length])

  const handleSend = () => {
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await sendReply(otherUserId, body.trim())
      if (res?.error) { setError(res.error); return }
      setBody('')
      router.refresh()
    })
  }

  return (
    // 56px header + 56px AppNav = 112px total chrome to subtract
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 112px)' }}>
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {initialMessages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say something!</p>
        )}

        {initialMessages.map((msg, i) => {
          const isFromMe = msg.sender_id === currentUserId
          const prevMsg = initialMessages[i - 1]
          const showTime = !prevMsg ||
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000

          return (
            <div key={msg.id}>
              {showTime && (
                <p className="text-center text-[10px] text-gray-400 font-medium my-2">
                  {timeLabel(msg.created_at)}
                </p>
              )}
              <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isFromMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {msg.body && (
                    <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${
                      isFromMe
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                    }`}>
                      {msg.body}
                    </div>
                  )}
                  {msg.program_share_token && msg.program_name && (
                    <ProgramCard
                      token={msg.program_share_token}
                      name={msg.program_name}
                      isFromMe={isFromMe}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
        {error && <p className="text-xs text-red-500 font-medium mb-2">{error}</p>}
        <div className="flex gap-2 items-end">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder={`Message ${otherName}…`}
            rows={1}
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500 max-h-32"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={handleSend}
            disabled={isPending || !body.trim()}
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-blue-700 transition-colors active:scale-95"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
