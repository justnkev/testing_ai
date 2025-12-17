-- Add missing macronutrient columns for meal tracking
alter table if exists public.meals
    add column if not exists protein_g int4,
    add column if not exists fat_g int4,
    add column if not exists carbs_g int4;

-- Ensure authenticated users can read and write their own meals when RLS is enabled
alter table if exists public.meals enable row level security;

create policy if not exists meals_select_own_rows
    on public.meals
    for select
    using (auth.uid() = user_id);

create policy if not exists meals_insert_own_rows
    on public.meals
    for insert
    with check (auth.uid() = user_id);
