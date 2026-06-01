'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateProgramShareToken } from '@/app/workout/actions'
import { sendPushToUser } from '@/lib/webpush'

// ── User search ───────────────────────────────────────────────────────────────

export async function searchUsers(query: string) {
  if (!query.trim()) return []
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('user_settings')
    .select('user_id, screen_name')
    .ilike('screen_name', `%${query.trim()}%`)
    .neq('user_id', user.id)
    .limit(8)

  return (data || []) as { user_id: string; screen_name: string | null }[]
}

// ── Sending ───────────────────────────────────────────────────────────────────

export async function sendMessage({
  recipientId,
  body,
  programId,
}: {
  recipientId: string
  body: string
  programId?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  let program_share_token: string | null = null
  let program_name: string | null = null

  if (programId) {
    const { data: prog } = await supabase
      .from('programs')
      .select('name, share_token')
      .eq('id', programId)
      .eq('user_id', user.id)
      .single()

    if (prog) {
      program_name = prog.name
      if (prog.share_token) {
        program_share_token = prog.share_token
      } else {
        const res = await generateProgramShareToken(programId)
        if (res?.success && res.token) program_share_token = res.token
      }
    }
  }

  const { error } = await supabase.from('direct_messages').insert({
    sender_id: user.id,
    recipient_id: recipientId,
    body: body.trim() || null,
    program_share_token,
    program_name,
  })

  if (error) return { error: error.message }

  // Push notification to recipient
  const { data: senderSettings } = await supabase
    .from('user_settings')
    .select('screen_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const senderName = senderSettings?.screen_name?.trim() || 'Someone'
  const pushBody = program_name
    ? `Shared a program: ${program_name}`
    : body.trim().length > 80 ? body.trim().slice(0, 80) + '…' : body.trim()

  sendPushToUser(recipientId, {
    title: senderName,
    body:  pushBody || 'Sent you a message',
    url:   `/inbox/${user.id}`,
  }).catch(err => console.error('[push] sendPushToUser failed:', err))

  revalidatePath('/inbox')
  revalidatePath(`/inbox/${recipientId}`)
  return { success: true }
}

export async function sendReply(otherUserId: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  if (!body.trim()) return { error: 'Empty message' }

  const { error } = await supabase.from('direct_messages').insert({
    sender_id: user.id,
    recipient_id: otherUserId,
    body: body.trim(),
  })

  if (error) return { error: error.message }
  revalidatePath(`/inbox/${otherUserId}`)
  revalidatePath('/inbox')
  return { success: true }
}

// ── Fetching ──────────────────────────────────────────────────────────────────

export async function getConversations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: messages } = await supabase
    .from('direct_messages')
    .select('id, sender_id, recipient_id, body, program_name, created_at, read_at')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(300)

  if (!messages?.length) return []

  // Keep only the most recent message per conversation partner
  const convMap = new Map<string, typeof messages[0]>()
  const unreadMap = new Map<string, number>()

  for (const msg of messages) {
    const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id
    if (!convMap.has(partnerId)) convMap.set(partnerId, msg)
    if (msg.recipient_id === user.id && !msg.read_at) {
      unreadMap.set(partnerId, (unreadMap.get(partnerId) ?? 0) + 1)
    }
  }

  const partnerIds = [...convMap.keys()]
  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id, screen_name')
    .in('user_id', partnerIds)

  const nameMap = Object.fromEntries((settings || []).map(s => [s.user_id, s.screen_name]))

  return partnerIds.map(partnerId => ({
    partnerId,
    partnerName: (nameMap[partnerId] as string | null) ?? 'Unknown',
    latestMessage: convMap.get(partnerId)!,
    unreadCount: unreadMap.get(partnerId) ?? 0,
  }))
}

export async function getThread(otherUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { messages: [], otherUser: null, currentUserId: '' }

  const [{ data: messages }, { data: otherSettings }] = await Promise.all([
    supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),` +
        `and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true }),
    supabase
      .from('user_settings')
      .select('user_id, screen_name')
      .eq('user_id', otherUserId)
      .maybeSingle(),
  ])

  // Mark incoming unread messages as read
  const unreadIds = (messages || [])
    .filter(m => m.sender_id === otherUserId && !m.read_at)
    .map(m => m.id)

  if (unreadIds.length) {
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
    // Note: no revalidatePath here — getThread is called during render.
    // The inbox list uses noStore() and the AppNav badge re-queries on navigation,
    // so both will reflect the updated read state on next load automatically.
  }

  return {
    messages: messages || [],
    otherUser: otherSettings as { user_id: string; screen_name: string | null } | null,
    currentUserId: user.id,
  }
}

export async function fetchUserProgramNames() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('programs')
    .select('id, name, share_token')
    .eq('user_id', user.id)
    .order('name')
  return (data || []) as { id: string; name: string; share_token: string | null }[]
}

export async function getUnreadCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null)

  return count ?? 0
}
