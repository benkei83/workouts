'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Like / unlike ─────────────────────────────────────────────────────────────

export async function toggleLike(postId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from('feed_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('feed_likes').delete()
      .eq('post_id', postId).eq('user_id', user.id)
  } else {
    await supabase.from('feed_likes').insert({ post_id: postId, user_id: user.id })
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(
  postId: string,
  content: string,
): Promise<{ comment: { id: string; user_id: string; screen_name: string | null; content: string; created_at: string } | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { comment: null, error: 'Not authenticated' }

  const trimmed = content.trim().slice(0, 500)
  if (!trimmed) return { comment: null, error: 'Empty comment' }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('screen_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('feed_comments')
    .insert({
      post_id:     postId,
      user_id:     user.id,
      screen_name: settings?.screen_name ?? null,
      content:     trimmed,
    })
    .select('id, user_id, screen_name, content, created_at')
    .single()

  if (error || !data) return { comment: null, error: error?.message }
  return { comment: data }
}

export async function deleteComment(commentId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('feed_comments').delete()
    .eq('id', commentId).eq('user_id', user.id)
}

// ── Post a chat message ───────────────────────────────────────────────────────

export async function postMessage(content: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = content.trim().slice(0, 300)
  if (!trimmed) return { error: 'Empty message' }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('screen_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase.from('feed_posts').insert({
    user_id:     user.id,
    post_type:   'message',
    screen_name: settings?.screen_name ?? null,
    message:     trimmed,
  })

  if (error) return { error: error.message }

  revalidatePath('/feed')
  revalidatePath('/')
  return { ok: true }
}

// ── Hide own post from feed (used from feed card) ─────────────────────────────

export async function hideFeedPost(postId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('feed_posts').update({ is_visible: false })
    .eq('id', postId).eq('user_id', user.id)

  revalidatePath('/feed')
}
