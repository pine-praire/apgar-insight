-- user_roles: a row here means the user is an admin
create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role = 'admin'),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

-- users can read their own role (used by the client to show/hide the admin link)
create policy "user_roles_select_own" on public.user_roles
  for select using (auth.uid() = user_id);
-- no INSERT/UPDATE/DELETE policies — only the service-role key can write rows

-- additive SELECT policy: admins can read ALL profiles
create policy "profiles_select_admin" on public.profiles
  for select using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- additive SELECT policy: admins can read ALL results
create policy "results_select_admin" on public.apgar_results
  for select using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- security-definer function: joins auth.users with profiles, only admins can call
create or replace function public.get_admin_users()
returns table (
  id           uuid,
  email        text,
  display_name text,
  created_at   timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Forbidden' using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.display_name,
      p.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by p.created_at desc;
end;
$$;

revoke execute on function public.get_admin_users() from public, anon;
grant  execute on function public.get_admin_users() to authenticated;