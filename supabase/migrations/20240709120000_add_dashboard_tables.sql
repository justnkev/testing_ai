-- Migration to add health data tables for dashboard visualizations

-- Workouts table stores exercise details linked to users and progress logs
create table if not exists public.workouts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id),
    created_at timestamptz not null default now(),
    workout_type text,
    duration_min int4,
    metadata jsonb,
    date_inferred date,
    progress_log_id int8 references public.progress_logs (id)
);

create index if not exists workouts_user_id_idx on public.workouts (user_id);
create index if not exists workouts_date_inferred_idx on public.workouts (date_inferred);

-- Sleep table captures sleep sessions per user with optional progress log linkage
create table if not exists public.sleep (
    id int8 generated always as identity primary key,
    user_id uuid not null references auth.users (id),
    quality text,
    metadata jsonb,
    time_asleep text,
    created_at timestamptz not null default now(),
    date_inferred date,
    progress_log_id int8 references public.progress_logs (id)
);

create index if not exists sleep_user_id_idx on public.sleep (user_id);
create index if not exists sleep_date_inferred_idx on public.sleep (date_inferred);

-- Meals table stores meal entries with calorie counts and metadata
create table if not exists public.meals (
    id int8 generated always as identity primary key,
    user_id uuid not null references auth.users (id),
    created_at timestamptz not null default now(),
    meal_type text,
    calories int4,
    metadata jsonb,
    date_inferred date,
    progress_log_id int8 references public.progress_logs (id)
);

create index if not exists meals_user_id_idx on public.meals (user_id);
create index if not exists meals_date_inferred_idx on public.meals (date_inferred);
