import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProgramManager from '@/components/ProgramManager'

export default function ProgramsPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24 relative">
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500">
          ←
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Programs</h1>
      </header>

      <div className="p-6">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-pulse">
            <div className="h-16 w-16 bg-gray-200 rounded-full"></div>
            <p className="text-gray-400 font-medium">Loading programs...</p>
          </div>
        }>
          <ProgramDataLoader />
        </Suspense>
      </div>
    </main>
  )
}

async function ProgramDataLoader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('category', 'strength')
    .eq('user_id', user.id)
    .order('name')

  const { data: programs } = await supabase
    .from('programs')
    .select(`
      *, share_token,
      program_workouts (
        *,
        program_exercises (
          *,
          exercises ( id, name ),
          superset_templates ( id, name, superset_template_exercises ( sort_order, exercise_id, exercises(id, name) ) )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('name')

  const { data: activeProgram } = await supabase
    .from('user_active_programs')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: supersetTemplates } = await supabase
    .from('superset_templates')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  return (
    <ProgramManager
      initialPrograms={(programs as any) || []}
      exercises={exercises || []}
      supersetTemplates={supersetTemplates || []}
      userId={user.id}
      activeProgram={activeProgram || null}
    />
  )
}
