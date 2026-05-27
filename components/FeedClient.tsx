'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toggleLike, addComment, deleteComment, postMessage, hideFeedPost } from '@/app/feed/actions'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeedComment {
  id:          string
  user_id:     string
  screen_name: string | null
  content:     string
  created_at:  string
}

export interface FeedExercise {
  name:       string
  sets:       number
  max_weight: number
  top_reps:   number
}

export interface FeedCardio {
  session_type: string | null
  distance_km:  number
}

export interface FeedPost {
  id:          string
  post_type:   'workout' | 'message'
  user_id:     string
  screen_name: string | null
  workout_id:  string | null
  workout_title: string | null
  workout_summary: {
    duration_mins: number
    exercises:     FeedExercise[]
    total_sets:    number
    total_volume:  number
    prs:          { exercise: string; weight: number; reps: number }[]
    achievements?: { label: string }[]
    cardio?:       FeedCardio[]
  } | null
  message:     string | null
  created_at:  string
  like_count:  number
  liked_by_me: boolean
  comments:    FeedComment[]
}

interface Props {
  initialPosts: FeedPost[]
  currentUserId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function displayName(name: string | null): string {
  return name?.trim() || 'Anonymous'
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M kg`
  if (v >= 1_000)     return `${Math.round(v / 1_000)}k kg`
  return `${v} kg`
}

// ── Comment component ─────────────────────────────────────────────────────────

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment:       FeedComment
  currentUserId: string
  onDelete:      (id: string) => void
}) {
  const isOwn = comment.user_id === currentUserId

  return (
    <div className="flex items-start gap-2 py-2">
      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-gray-500">
        {displayName(comment.screen_name)[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-gray-800">{displayName(comment.screen_name)}</span>
          <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-xs text-gray-700 mt-0.5 break-words">{comment.content}</p>
      </div>
      {isOwn && (
        <button
          onClick={() => onDelete(comment.id)}
          className="text-[10px] text-gray-300 hover:text-red-400 transition-colors shrink-0 pt-0.5"
          aria-label="Delete comment"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ── Exercise row ──────────────────────────────────────────────────────────────

function ExerciseRow({ ex }: { ex: FeedExercise }) {
  return (
    <div className="flex items-baseline justify-between py-1 gap-2">
      <span className="text-xs text-gray-700 font-medium truncate flex-1">{ex.name}</span>
      <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
        {ex.sets} set{ex.sets !== 1 ? 's' : ''}
        {ex.max_weight > 0 && (
          <> · <span className="text-gray-600 font-semibold">{ex.max_weight} kg × {ex.top_reps}</span></>
        )}
      </span>
    </div>
  )
}

// ── Feed card ─────────────────────────────────────────────────────────────────

function FeedCard({
  post,
  currentUserId,
  onHide,
}: {
  post:          FeedPost
  currentUserId: string
  onHide:        (id: string) => void
}) {
  const [liked, setLiked]               = useState(post.liked_by_me)
  const [likeCount, setLikeCount]       = useState(post.like_count)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments]         = useState<FeedComment[]>(post.comments)
  const [commentText, setCommentText]   = useState('')
  const [commenting, startComment]      = useTransition()
  const [liking, startLike]             = useTransition()
  const commentInputRef = useRef<HTMLInputElement>(null)

  const isOwn   = post.user_id === currentUserId
  const summary = post.workout_summary

  const handleLike = () => {
    const next = !liked
    setLiked(next)
    setLikeCount(c => next ? c + 1 : c - 1)
    startLike(async () => { await toggleLike(post.id) })
  }

  const handleComment = async () => {
    const text = commentText.trim()
    if (!text) return
    setCommentText('')
    startComment(async () => {
      const result = await addComment(post.id, text)
      if (result.comment) {
        setComments(prev => [...prev, result.comment!])
      }
    })
  }

  const handleDeleteComment = (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId))
    startComment(async () => { await deleteComment(commentId) })
  }

  const toggleComments = () => {
    setShowComments(s => !s)
    if (!showComments) setTimeout(() => commentInputRef.current?.focus(), 100)
  }

  // Decide whether exercises are the old string[] format (legacy posts) or new object[]
  const exercises: FeedExercise[] = summary?.exercises
    ? (summary.exercises as any[]).map(e =>
        typeof e === 'string'
          ? { name: e, sets: 0, max_weight: 0, top_reps: 0 }
          : (e as FeedExercise)
      )
    : []

  const cardioSessions = summary?.cardio ?? []
  const totalCardioKm  = Math.round(
    cardioSessions.reduce((s, c) => s + c.distance_km, 0) * 10
  ) / 10

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0 text-xs font-extrabold text-white">
            {displayName(post.screen_name)[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{displayName(post.screen_name)}</p>
            <p className="text-[10px] text-gray-400">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        {isOwn && (
          <button
            onClick={() => onHide(post.id)}
            className="text-[10px] text-gray-300 hover:text-red-400 transition-colors p-1"
            aria-label="Remove from feed"
          >
            ✕
          </button>
        )}
      </div>

      {/* Workout content */}
      {post.post_type === 'workout' && summary && (
        <div className="px-4 pb-3">
          {post.workout_title && (
            <p className="text-sm font-extrabold text-gray-900 mb-2">{post.workout_title}</p>
          )}

          {/* Stats row */}
          <div className="flex gap-4 text-[11px] text-gray-500 font-semibold mb-3 flex-wrap">
            {summary.duration_mins > 0 && <span>⏱ {summary.duration_mins} min</span>}
            {summary.total_sets > 0    && <span>🏋️ {summary.total_sets} sets</span>}
            {summary.total_volume > 0  && <span>📦 {formatVolume(summary.total_volume)}</span>}
            {totalCardioKm > 0         && <span>🏃 {totalCardioKm} km</span>}
          </div>

          {/* Cardio sessions */}
          {cardioSessions.length > 0 && (
            <div className="mb-3 divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
              {cardioSessions.map((c, i) => (
                <div key={i} className="px-3 py-1 bg-blue-50/40 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-gray-700 font-medium">
                    🏃 {c.session_type ?? 'Cardio'}
                  </span>
                  <span className="text-[11px] text-gray-600 font-semibold tabular-nums">
                    {c.distance_km} km
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Strength exercise table */}
          {exercises.length > 0 && (
            <div className="mb-3 divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
              {exercises.map((ex, i) => (
                <div key={i} className="px-3 bg-gray-50/50">
                  <ExerciseRow ex={ex} />
                </div>
              ))}
            </div>
          )}

          {/* PRs */}
          {summary.prs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {summary.prs.map((pr, i) => (
                <span
                  key={i}
                  className="text-[11px] font-bold bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full"
                >
                  🏆 {pr.exercise} {pr.weight} kg × {pr.reps}
                </span>
              ))}
            </div>
          )}

          {/* Goal achievements */}
          {(summary.achievements ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(summary.achievements ?? []).map((a, i) => (
                <span
                  key={i}
                  className="text-[11px] font-bold bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full"
                >
                  🎯 {a.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message content */}
      {post.post_type === 'message' && post.message && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-800 leading-relaxed">{post.message}</p>
        </div>
      )}

      {/* Footer: likes + comments */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100">
        <button
          onClick={handleLike}
          disabled={liking}
          className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
            liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
          }`}
        >
          <span>{liked ? '❤️' : '🤍'}</span>
          <span>{likeCount > 0 ? likeCount : ''}</span>
        </button>

        <button
          onClick={toggleComments}
          className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
            showComments ? 'text-blue-500' : 'text-gray-400 hover:text-blue-400'
          }`}
        >
          <span>💬</span>
          <span>{comments.length > 0 ? comments.length : 'Comment'}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-gray-50 px-4 pt-2 pb-3">
          {comments.length > 0 && (
            <div className="divide-y divide-gray-50 mb-2">
              {comments.map(c => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  currentUserId={currentUserId}
                  onDelete={handleDeleteComment}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
              placeholder="Add a comment…"
              maxLength={500}
              className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400"
            />
            <button
              onClick={handleComment}
              disabled={commenting || !commentText.trim()}
              className="text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Post message form ─────────────────────────────────────────────────────────

function PostMessageForm({ onPosted }: { onPosted: (post: FeedPost) => void }) {
  const [text, setText]              = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const router = useRouter()

  const handlePost = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setError(null)
    startTransition(async () => {
      const result = await postMessage(trimmed)
      if ('error' in result) {
        setError(result.error)
      } else {
        setText('')
        router.refresh()   // re-fetch server component so the new post appears
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-bold text-gray-500 mb-2">Say something to the community</p>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePost()}
          placeholder="What's on your mind?"
          maxLength={300}
          className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400"
        />
        <button
          onClick={handlePost}
          disabled={isPending || !text.trim()}
          className="text-sm font-bold text-white bg-gray-900 hover:bg-gray-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 shrink-0"
        >
          {isPending ? '…' : 'Post'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 font-semibold mt-2">{error}</p>}
    </div>
  )
}

// ── Main feed component ───────────────────────────────────────────────────────

export default function FeedClient({ initialPosts, currentUserId }: Props) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts)
  const router = useRouter()

  // Sync local state when the server re-fetches (router.refresh() updates initialPosts
  // but useState only reads the initial value once — this effect keeps them in sync)
  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts])

  // Refresh server data whenever this tab becomes visible again
  // (covers finishing a workout in another tab, then switching back)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [router])

  const handleHide = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
    hideFeedPost(postId)
  }

  return (
    <div className="space-y-4">
      <PostMessageForm onPosted={() => {}} />

      {posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-sm font-semibold">No posts yet</p>
          <p className="text-xs mt-1">Finish a workout or say hi to get things started.</p>
        </div>
      ) : (
        posts.map(post => (
          <FeedCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onHide={handleHide}
          />
        ))
      )}
    </div>
  )
}
