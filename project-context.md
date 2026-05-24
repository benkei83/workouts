# Project Architecture: Fitness Engine

## 1. Tech Stack
* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Database & Authentication:** Supabase (PostgreSQL with RLS)
* **Deployment:** Vercel

## 2. Core Concepts
* **Templates (Dimensions):** Standard exercises and structured programs.
* **User State (Progression Engine):** Tracking current weight, speed, and active program rotation. Utilizes Slowly Changing Dimensions (SCD Type 2) to preserve historical progress.
* **Logs (Fact Tables):** Actual workout logs, separated into cardio and strength, but tied together by a parent `workouts` bucket to allow hybrid sessions.

## 3. Database Schema (Supabase PostgreSQL)

```sql
-- PILLAR 1: THE TEMPLATES (Read-Only to Users)
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('strength', 'running_distance', 'running_intervals')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE program_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    rotation_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(program_id, rotation_order)
);

CREATE TABLE program_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_workout_id UUID REFERENCES program_workouts(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    standard_sets INTEGER,
    standard_reps INTEGER
);

-- PILLAR 2: THE USER STATE (Progression Engine)
CREATE TABLE user_active_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    current_rotation_index INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- SCD Type 2 Table for Historical Tracking
CREATE TABLE user_exercise_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
    
    current_weight NUMERIC,
    increment_step NUMERIC DEFAULT 2.5,
    target_sets INTEGER,
    target_reps INTEGER,
    
    work_speed NUMERIC,       
    rest_speed NUMERIC,       
    incline NUMERIC,          
    duration_mins INTEGER, 
    
    failure_count INTEGER DEFAULT 0,
    deload_threshold INTEGER DEFAULT 3,
    
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);
CREATE UNIQUE INDEX idx_active_user_exercise_settings ON user_exercise_settings(user_id, exercise_id) WHERE is_active = TRUE;

-- PILLAR 3: THE LOGS (Fact Tables)
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    total_duration_mins INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE running_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
    environment TEXT CHECK (environment IN ('indoor', 'outdoor')),
    session_type TEXT CHECK (session_type IN ('distance', 'interval')),
    distance_km NUMERIC,
    duration_seconds INTEGER,
    average_speed NUMERIC,
    average_incline NUMERIC
);

CREATE TABLE strength_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
    program_name TEXT
);

CREATE TABLE strength_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strength_log_id UUID REFERENCES strength_logs(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    target_weight NUMERIC,
    target_reps INTEGER,
    actual_weight NUMERIC,
    actual_reps INTEGER
);


## 3. Current folder structure

fitness-engine/
├── app/
│   ├── sign-in/
│   │   └── page.tsx
│   ├── workout/
│   │   ├── [id]/
│   │   │   ├── page.tsx (Active Canvas)
│   │   │   └── InteractiveCanvas.tsx (Client Component)
│   │   └── actions.ts (Server Actions for logging)
│   ├── layout.tsx
│   └── page.tsx (Dashboard)
├── components/
│   ├── CardioForm.tsx
│   └── login-form.tsx
├── lib/
│   └── supabase/
│       └── server.ts
├── project-context.md
└── package.json