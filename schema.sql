
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,24}$')
);
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  join_code text not null unique default replace(gen_random_uuid()::text,'-',''),
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (group_id,user_id)
);
create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  full_name text not null default '',
  course text not null default '',
  source text not null default '',
  events jsonb not null default '[]'::jsonb check (jsonb_typeof(events)='array'),
  created_at timestamptz not null default now()
);
create table if not exists public.group_timetables (
  group_id uuid not null references public.groups(id) on delete cascade,
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id,timetable_id)
);
create index if not exists members_user_idx on public.group_members(user_id);
create index if not exists timetables_owner_idx on public.timetables(owner_id);
create index if not exists group_timetables_timetable_idx on public.group_timetables(timetable_id);
create or replace function public.make_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,username)
  values(new.id,trim(new.raw_user_meta_data->>'username'));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.make_profile();
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_members
    where group_id = p_group and user_id = (select auth.uid()));
$$;
create or replace function public.is_group_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.groups
    where id = p_group and owner_id = (select auth.uid()));
$$;
create or replace function public.can_view_timetable(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_timetables gt
  join public.group_members gm on gm.group_id=gt.group_id
  where gt.timetable_id=p_id and gm.user_id=(select auth.uid()));
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.timetables enable row level security;
alter table public.group_timetables enable row level security;

drop policy if exists profile_view on public.profiles;
create policy profile_view on public.profiles for select to authenticated
  using (id=(select auth.uid()) or exists (
    select 1 from public.group_members gm
    where gm.user_id=profiles.id and public.is_group_member(gm.group_id)));
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists groups_view on public.groups;
create policy groups_view on public.groups for select to authenticated using (public.is_group_member(id));
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete to authenticated using (owner_id=(select auth.uid()));

drop policy if exists members_view on public.group_members;
create policy members_view on public.group_members for select to authenticated using (public.is_group_member(group_id));
drop policy if exists members_leave_or_kick on public.group_members;
create policy members_leave_or_kick on public.group_members for delete to authenticated
  using ((user_id=(select auth.uid()) and role<>'owner') or
    (public.is_group_owner(group_id) and role<>'owner'));

drop policy if exists timetables_view on public.timetables;
create policy timetables_view on public.timetables for select to authenticated
  using (owner_id=(select auth.uid()) or public.can_view_timetable(id));
drop policy if exists timetables_insert on public.timetables;
create policy timetables_insert on public.timetables for insert to authenticated
  with check (owner_id=(select auth.uid()));
drop policy if exists timetables_update on public.timetables;
create policy timetables_update on public.timetables for update to authenticated
  using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
drop policy if exists timetables_delete on public.timetables;
create policy timetables_delete on public.timetables for delete to authenticated
  using (owner_id=(select auth.uid()));

drop policy if exists group_timetables_view on public.group_timetables;
create policy group_timetables_view on public.group_timetables for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists group_timetables_add on public.group_timetables;
create policy group_timetables_add on public.group_timetables for insert to authenticated
  with check (public.is_group_member(group_id) and added_by=(select auth.uid()) and
    exists (select 1 from public.timetables t where t.id=timetable_id and t.owner_id=(select auth.uid())));
drop policy if exists group_timetables_remove on public.group_timetables;
create policy group_timetables_remove on public.group_timetables for delete to authenticated
  using (public.is_group_owner(group_id) or exists (
    select 1 from public.timetables t where t.id=timetable_id and t.owner_id=(select auth.uid())));
create or replace function public.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 80 then
    raise exception 'Group name must be between 1 and 80 characters'; end if;
  insert into public.groups(owner_id,name) values((select auth.uid()),trim(p_name)) returning id into gid;
  insert into public.group_members(group_id,user_id,role) values(gid,(select auth.uid()),'owner');
  return gid;
end; $$;
create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  select g.id into gid from public.groups g where g.join_code=lower(trim(p_code));
  if gid is null then raise exception 'Invalid invitation code'; end if;
  insert into public.group_members(group_id,user_id,role)
  values(gid,(select auth.uid()),'member') on conflict(group_id,user_id) do nothing;
  return gid;
end; $$;
create or replace function public.rotate_group_invite(p_group_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare new_code text;
begin
  if not public.is_group_owner(p_group_id) then raise exception 'Only the group owner can reset the invite'; end if;
  update public.groups set join_code=replace(gen_random_uuid()::text,'-','')
    where id=p_group_id returning join_code into new_code;
  return new_code;
end; $$;
revoke all on function public.create_group(text) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.rotate_group_invite(uuid) from public, anon;
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_owner(uuid) from public, anon;
revoke all on function public.can_view_timetable(uuid) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.rotate_group_invite(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.can_view_timetable(uuid) to authenticated;
create or replace function public.unlink_departing_member_timetables()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.group_timetables gt
  using public.timetables t
  where gt.group_id=old.group_id and gt.timetable_id=t.id and t.owner_id=old.user_id;
  return old;
end; $$;
drop trigger if exists on_group_member_removed on public.group_members;
create trigger on_group_member_removed before delete on public.group_members
for each row execute procedure public.unlink_departing_member_timetables();
