import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FeedClient from '@/components/FeedClient'
import type { FeedPost, FeedComment } from '@/components/FeedClient'
import { unstable_noStore as noStore } from 'next/cache'

export default function FeedPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Community Feed</h1>
          <p className="text-xs text-gray-400 font-medium">Workouts, PRs &amp; chat</p>
        </div>
      </header>

      <div className="p-4">
        <Suspense
          fallback={
            <div className="space-y-4 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 bg-gray-200 rounded-2xl" />
              ))}
            </div>
          }
        >
          <FeedLoader />
        </Suspense>
      </div>
    </main>
  )
}

async function FeedLoader() {
  noStore() // opt out of component cache — always fetch live data
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  let posts: FeedPost[] = []

  try {
    const { data: rawPosts } = await supabase
      .from('feed_posts')
      .select(`
        id, post_type, user_id, screen_name,
        workout_id, workout_title, workout_summary,
        message, created_at,
        feed_likes ( user_id ),
        feed_comments ( id, user_id, screen_name, content, created_at )
      `)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(60)

    // Batch-fetch screen names for all likers in one query
    const allLikerIds = [...new Set(
      (rawPosts ?? []).flatMap(p =>
        ((p.feed_likes as { user_id: string }[]) ?? []).map(l => l.user_id)
      )
    )]
    const likerNames: Record<string, string | null> = {}
    if (allLikerIds.length > 0) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('user_id, screen_name')
        .in('user_id', allLikerIds)
      for (const s of settings ?? []) likerNames[s.user_id] = s.screen_name
    }

    posts = (rawPosts || []).map(p => {
      const likes    = (p.feed_likes    as { user_id: string }[]) || []
      const comments = (p.feed_comments as FeedComment[])         || []
      return {
        id:               p.id,
        post_type:        p.post_type as 'workout' | 'message',
        user_id:          p.user_id,
        screen_name:      p.screen_name,
        workout_id:       p.workout_id,
        workout_title:    p.workout_title,
        workout_summary:  p.workout_summary as FeedPost['workout_summary'],
        message:          p.message,
        created_at:       p.created_at,
        like_count:       likes.length,
        liked_by_me:      likes.some(l => l.user_id === user.id),
        liked_by:         likes.map(l => ({
          user_id:     l.user_id,
          screen_name: likerNames[l.user_id] ?? null,
        })),
        comments:         [...comments].sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        ),
      }
    })
  } catch {
    /* feed_posts table not created yet — show empty state */
  }

  return <FeedClient initialPosts={posts} currentUserId={user.id} />
}
