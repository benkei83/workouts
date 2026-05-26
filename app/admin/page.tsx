import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TROPHY_REGISTRY } from '@/lib/trophies/registry'
import { CATEGORY_LABELS, CATEGORY_EMOJI } from '@/lib/trophies/types'
import type { TrophyCategory } from '@/lib/trophies/types'
import { ForceEvaluateButton, ClearTrophiesButton } from './AdminControls'

// ── Sync page shell ───────────────────────────────────────────────────────────
export default function AdminPage() {
  return (
    <main className="max-w-2xl mx-auto min-h-screen bg-gray-50 pb-16">
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <p className="text-gray-400 text-sm animate-pulse">Loading admin…</p>
        </div>
      }>
        <AdminContent />
      </Suspense>
    </main>
  )
}

// ── Async content (all DB access lives here) ──────────────────────────────────
async function AdminContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail && user.email !== adminEmail) redirect('/')

  // Fetch all earned trophies
  let earnedRows: { trophy_id: string; tier: number; unlocked_at: string }[] = []
  try {
    const { data } = await supabase
      .from('user_trophies')
      .select('trophy_id, tier, unlocked_at')
      .eq('user_id', user.id)
    earnedRows = data ?? []
  } catch { /* table not migrated yet */ }

  const earnedByTrophy = new Map<string, Set<number>>()
  for (const row of earnedRows) {
    if (!earnedByTrophy.has(row.trophy_id)) earnedByTrophy.set(row.trophy_id, new Set())
    earnedByTrophy.get(row.trophy_id)!.add(row.tier)
  }

  const categories: TrophyCategory[] = ['volume', 'strength', 'consistency', 'cardio', 'mastery', 'grit']
  const tierEmojis = ['🥉', '🥈', '🥇', '💎']

  return (
    <>
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-7 z-10 shadow-sm flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Admin</h1>
          <p className="text-xs text-gray-400 font-medium">{user.email}</p>
        </div>
      </header>

      <div className="px-4 pt-6 space-y-8">

        {/* Controls */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
          <h2 className="text-sm font-bold text-gray-700">Trophy Engine</h2>
          <div className="space-y-3">
            <ForceEvaluateButton />
            <ClearTrophiesButton />
          </div>
          <p className="text-xs text-gray-400">
            {earnedRows.length} tier row{earnedRows.length !== 1 ? 's' : ''} earned across {earnedByTrophy.size} trophy{earnedByTrophy.size !== 1 ? 'ies' : ''}.
          </p>
        </section>

        {/* Full registry */}
        {categories.map((cat) => {
          const trophies = TROPHY_REGISTRY.filter((t) => t.category === cat)
          return (
            <section key={cat}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span>{CATEGORY_EMOJI[cat]}</span>
                <span>{CATEGORY_LABELS[cat]}</span>
              </h2>

              <div className="space-y-2">
                {trophies.map((trophy) => {
                  const earned = earnedByTrophy.get(trophy.id) ?? new Set()
                  const maxEarned = earned.size > 0 ? Math.max(...earned) : 0

                  return (
                    <div
                      key={trophy.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex gap-1 flex-shrink-0 mt-0.5">
                          {tierEmojis.map((em, i) => {
                            const tierLevel = i + 1
                            const isEarned = earned.has(tierLevel)
                            return (
                              <span
                                key={tierLevel}
                                className={`text-lg ${isEarned ? 'opacity-100' : 'opacity-20'}`}
                                title={trophy.tiers[i].label}
                              >
                                {em}
                              </span>
                            )
                          })}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <code className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                              {trophy.id}
                            </code>
                            <code className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-mono">
                              {trophy.evaluator}
                            </code>
                            {maxEarned > 0 && (
                              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                Tier {maxEarned} ✓
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-600 italic leading-snug">
                            "{trophy.quote}"
                            {trophy.attribution && (
                              <span className="not-italic text-gray-400"> {trophy.attribution}</span>
                            )}
                          </p>

                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {trophy.tiers.map((t) => (
                              <span
                                key={t.level}
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                  earned.has(t.level)
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {t.label}: {t.threshold.toLocaleString()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
