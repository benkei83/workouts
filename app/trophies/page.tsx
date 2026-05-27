import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TROPHY_REGISTRY } from '@/lib/trophies/registry'
import { CATEGORY_LABELS, CATEGORY_EMOJI } from '@/lib/trophies/types'
import type { TrophyCategory } from '@/lib/trophies/types'

// ── Sync page shell ───────────────────────────────────────────────────────────
export default function TrophiesPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-16">
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <p className="text-gray-400 text-sm animate-pulse">Loading trophies…</p>
        </div>
      }>
        <TrophiesContent />
      </Suspense>
    </main>
  )
}

// ── Async content (all DB access lives here) ──────────────────────────────────
async function TrophiesContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  let earnedRows: { trophy_id: string; tier: number; unlocked_at: string }[] = []
  try {
    const { data } = await supabase
      .from('user_trophies')
      .select('trophy_id, tier, unlocked_at')
      .eq('user_id', user.id)
    earnedRows = data ?? []
  } catch {
    // Table not migrated yet — show empty state
  }

  // Build a lookup: trophy_id → highest earned tier + date
  const earnedMap = new Map<string, { tier: number; unlockedAt: string }>()
  for (const row of earnedRows) {
    const existing = earnedMap.get(row.trophy_id)
    if (!existing || row.tier > existing.tier) {
      earnedMap.set(row.trophy_id, { tier: row.tier, unlockedAt: row.unlocked_at })
    }
  }

  const earned = TROPHY_REGISTRY.filter((t) => earnedMap.has(t.id))
  const totalEarned = earnedRows.length

  const categories: TrophyCategory[] = ['volume', 'strength', 'consistency', 'cardio', 'mastery', 'grit']
  const byCategory = new Map<TrophyCategory, typeof earned>()
  for (const cat of categories) {
    const group = earned.filter((t) => t.category === cat)
    if (group.length > 0) byCategory.set(cat, group)
  }

  const tierColors: Record<number, { ring: string; bg: string; text: string }> = {
    1: { ring: 'ring-amber-300',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
    2: { ring: 'ring-slate-300',  bg: 'bg-slate-50',  text: 'text-slate-600'  },
    3: { ring: 'ring-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    4: { ring: 'ring-indigo-300', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  }

  return (
    <>
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Trophies</h1>
          {totalEarned > 0 && (
            <p className="text-xs text-gray-400 font-medium">{totalEarned} tier{totalEarned !== 1 ? 's' : ''} earned</p>
          )}
        </div>
      </header>

      <div className="px-4 pt-6 space-y-8">
        {byCategory.size === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🏆</p>
            <p className="text-gray-500 font-medium text-sm">No trophies yet.</p>
            <p className="text-gray-400 text-xs mt-1">Keep training — they'll appear here as you earn them.</p>
          </div>
        ) : (
          [...byCategory.entries()].map(([cat, trophies]) => (
            <section key={cat}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span>{CATEGORY_EMOJI[cat]}</span>
                <span>{CATEGORY_LABELS[cat]}</span>
              </h2>

              <div className="space-y-3">
                {trophies.map((trophy) => {
                  const earned = earnedMap.get(trophy.id)!
                  const tier = trophy.tiers[earned.tier - 1]
                  const colors = tierColors[earned.tier] ?? tierColors[1]

                  return (
                    <div
                      key={trophy.id}
                      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ring-1 ${colors.ring}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${colors.bg}`}>
                          {tier.emoji}
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 ${colors.bg} ${colors.text}`}>
                            {tier.label}
                          </span>
                          <p className="text-xs text-gray-500 font-medium leading-snug mb-2">
                            {tier.description}
                          </p>
                          <blockquote className="border-l-2 border-gray-200 pl-2">
                            <p className="text-xs text-gray-700 italic leading-snug">
                              "{trophy.quote}"
                            </p>
                            {trophy.attribution && (
                              <footer className="text-[10px] text-gray-400 mt-0.5 not-italic font-medium">
                                {trophy.attribution}
                              </footer>
                            )}
                          </blockquote>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50">
                        {trophy.tiers.map((t) => (
                          <span
                            key={t.level}
                            title={t.label}
                            className={`text-base ${t.level <= earned.tier ? 'opacity-100' : 'opacity-20'}`}
                          >
                            {t.emoji}
                          </span>
                        ))}
                        <span className="text-[10px] text-gray-300 ml-auto">
                          {new Date(earned.unlockedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}
