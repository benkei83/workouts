import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { getConversations } from './actions'
import MessagesHeader from '@/components/MessagesHeader'

export default function InboxPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      <MessagesHeader />

      <div className="p-4">
        <Suspense fallback={
          <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        }>
          <ConversationList />
        </Suspense>
      </div>
    </main>
  )
}

async function ConversationList() {
  noStore()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const conversations = await getConversations()

  if (conversations.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-4xl">💬</p>
        <h2 className="text-lg font-bold text-gray-900">No messages yet</h2>
        <p className="text-sm text-gray-400">
          Tap the compose button to start a conversation, or share a program with someone.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {conversations.map(conv => {
        const msg = conv.latestMessage
        const isFromMe = msg.sender_id === user.id
        const preview = msg.program_name
          ? `📋 ${msg.program_name}`
          : msg.body
            ? msg.body.length > 60 ? msg.body.slice(0, 60) + '…' : msg.body
            : '—'
        const time = new Date(msg.created_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short',
        })

        return (
          <Link
            key={conv.partnerId}
            href={`/inbox/${conv.partnerId}`}
            className={`flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 border transition-colors hover:border-gray-300 ${
              conv.unreadCount > 0 ? 'border-blue-100 shadow-sm' : 'border-gray-100'
            }`}
          >
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 font-bold text-gray-600 text-sm">
              {(conv.partnerName ?? '?')[0].toUpperCase()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-bold text-sm ${conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                  {conv.partnerName}
                </span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{time}</span>
              </div>
              <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                {isFromMe ? 'You: ' : ''}{preview}
              </p>
            </div>

            {/* Unread badge */}
            {conv.unreadCount > 0 && (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
