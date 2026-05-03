
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- apgar_results
create table public.apgar_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  scores jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.apgar_results enable row level security;
create policy "results_select_own" on public.apgar_results for select using (auth.uid() = user_id);
create policy "results_insert_own" on public.apgar_results for insert with check (auth.uid() = user_id);
create policy "results_delete_own" on public.apgar_results for delete using (auth.uid() = user_id);
create index on public.apgar_results(user_id, created_at desc);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
