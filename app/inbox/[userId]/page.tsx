import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { getThread } from '../actions'
import ThreadClient from '@/components/ThreadClient'

export default function ThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col">
      <Suspense fallback={
        <div className="flex flex-col h-screen">
          <div className="bg-white px-6 py-4 border-b border-gray-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex-1 animate-pulse bg-gray-100" />
        </div>
      }>
        <ThreadLoader params={params} />
      </Suspense>
    </main>
  )
}

async function ThreadLoader({ params }: { params: Promise<{ userId: string }> }) {
  noStore()
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { messages, otherUser, currentUserId } = await getThread(userId)

  const otherName = otherUser?.screen_name ?? 'Unknown'

  return (
    <>
      <header className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3 flex-shrink-0">
        <Link href="/inbox" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500 flex-shrink-0">
          ←
        </Link>
        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
          {otherName[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 leading-tight">{otherName}</p>
        </div>
      </header>

      <ThreadClient
        messages={messages as any}
        otherUserId={userId}
        otherName={otherName}
        currentUserId={currentUserId}
      />
    </>
  )
}
