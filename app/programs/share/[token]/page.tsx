import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSharedProgramByToken, importSharedProgram } from '@/app/workout/actions'
import { redirect } from 'next/navigation'

export default function SharedProgramPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500">
          ←
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Shared Program</h1>
      </header>

      <div className="p-6">
        <Suspense fallback={
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded-xl w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-32 bg-gray-200 rounded-2xl" />
          </div>
        }>
          <SharedProgramLoader params={params} />
        </Suspense>
      </div>
    </main>
  )
}

async function SharedProgramLoader({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const program = await getSharedProgramByToken(token)

  if (!program) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-4xl">🔒</p>
        <h2 className="text-lg font-bold text-gray-900">Program not found</h2>
        <p className="text-sm text-gray-400">This link may have expired or been revoked.</p>
        <Link href="/programs" className="inline-block mt-4 text-sm font-bold text-blue-600 hover:underline">
          Browse my programs →
        </Link>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sortedDays = [...(program.program_workouts || [])].sort((a, b) => a.rotation_order - b.rotation_order)

  async function handleImport() {
    'use server'
    const res = await importSharedProgram(token)
    if (res?.error === 'Sign in to import programs') {
      redirect(`/sign-in?next=/programs/share/${token}`)
    }
    if (res?.success) {
      redirect('/programs')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">{program.name}</h2>
            {program.description && (
              <p className="text-sm text-gray-500 mt-1">{program.description}</p>
            )}
            <p className="text-xs font-semibold text-gray-400 mt-2 uppercase tracking-wider">
              {sortedDays.length}-day split
            </p>
          </div>
          <span className="text-3xl">📋</span>
        </div>
      </div>

      {/* Workout days */}
      <div className="space-y-4">
        {sortedDays.map(pw => {
          const sortedEx = [...(pw.program_exercises || [])].sort((a, b) => a.sort_order - b.sort_order)
          return (
            <div key={pw.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{pw.name}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {sortedEx.length === 0 ? (
                  <p className="px-5 py-3 text-sm text-gray-400 italic">No exercises</p>
                ) : sortedEx.map(pe => (
                  <div key={pe.id} className="px-5 py-3">
                    {(pe as any).superset_templates ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-500">🔄</span>
                        <span className="text-sm font-semibold text-gray-700">{(pe as any).superset_templates.name}</span>
                        <span className="text-[10px] text-blue-400 font-semibold uppercase">Superset</span>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-gray-900">{(pe as any).exercises?.name ?? '—'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Import CTA */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        {user ? (
          <>
            <p className="text-sm text-gray-600">
              Import this program to your account and start training with it.
              All exercises will be added to your library if they don't exist yet.
            </p>
            <form action={handleImport}>
              <button
                type="submit"
                className="w-full bg-black text-white font-bold rounded-xl py-4 hover:bg-gray-800 active:scale-[0.98] transition-all"
              >
                Import Program
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">Sign in to import this program to your account.</p>
            <Link
              href={`/sign-in?next=/programs/share/${token}`}
              className="w-full bg-black text-white font-bold rounded-xl py-4 flex items-center justify-center hover:bg-gray-800 active:scale-[0.98] transition-all"
            >
              Sign in to Import
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
