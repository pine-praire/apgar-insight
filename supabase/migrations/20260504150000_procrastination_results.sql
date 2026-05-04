create table public.procrastination_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  types      text[] not null,
  created_at timestamptz not null default now()
);
alter table public.procrastination_results enable row level security;

create policy "procrastination_results_select_own" on public.procrastination_results
  for select using (auth.uid() = user_id);

create policy "procrastination_results_insert_own" on public.procrastination_results
  for insert with check (auth.uid() = user_id);

create policy "procrastination_results_select_admin" on public.procrastination_results
  for select using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
  );
