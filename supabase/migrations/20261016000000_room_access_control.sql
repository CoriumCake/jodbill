-- ==============================================================================
-- jodbill: Account-based room sharing (owner / admin) with Row Level Security
--
-- - Every room has exactly one owner and any number of admins.
-- - Admins get the full experience (record, delete, edit room settings).
-- - Only the owner can invite/remove admins or delete the room.
-- - Invites are bound to a specific (verified) email address; the invitee must
--   log in with that account to join.
-- ==============================================================================

-- ---------- 1. Roles: owner | admin ----------
alter table public.room_members drop constraint if exists room_members_role_check;
update public.room_members set role = 'admin' where role in ('editor', 'viewer');
alter table public.room_members add constraint room_members_role_check check (role in ('owner', 'admin'));
alter table public.room_members alter column room_id set not null;
alter table public.room_members alter column user_id set not null;
create index if not exists room_members_user_idx on public.room_members (user_id);

-- Drop the shared placeholder room if nothing references it
delete from public.rooms r
where r.id = 'default-room'
  and not exists (select 1 from public.readings x where x.room_id = r.id);

alter table public.readings alter column room_id drop default;
alter table public.readings alter column room_id set not null;
-- Author of a reading is always the caller; upserts never overwrite it
alter table public.readings alter column user_id set default auth.uid();
create index if not exists readings_room_idx on public.readings (room_id, timestamp desc);

-- Backfill owner memberships for existing rooms
insert into public.room_members (room_id, user_id, role)
select id, owner_id, 'owner' from public.rooms where owner_id is not null
on conflict (room_id, user_id) do update set role = 'owner';

-- ---------- 2. Invites ----------
create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  invited_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz
);
create unique index if not exists room_invites_pending_email_idx
  on public.room_invites (room_id, lower(email)) where accepted_at is null;
alter table public.room_invites enable row level security;

-- ---------- 3. Helper functions (security definer avoids RLS recursion) ----------
create or replace function public.is_room_member(p_room_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_owner(p_room_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Creator of a room automatically becomes its owner member
create or replace function public.handle_new_room()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    insert into public.room_members (room_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict (room_id, user_id) do update set role = 'owner';
  end if;
  return new;
end;
$$;

drop trigger if exists on_room_created on public.rooms;
create trigger on_room_created after insert on public.rooms
  for each row execute function public.handle_new_room();

-- Admins may edit settings but never ownership or the room id
create or replace function public.guard_room_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
    raise exception 'room id and owner cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_room_update on public.rooms;
create trigger guard_room_update before update on public.rooms
  for each row execute function public.guard_room_update();

-- ---------- 4. Row Level Security policies ----------
drop policy if exists "Allow all users to select rooms" on public.rooms;
drop policy if exists "Allow users to insert/update rooms" on public.rooms;
drop policy if exists "Allow all users to select readings" on public.readings;
drop policy if exists "Allow users to insert/update readings" on public.readings;
drop policy if exists "Allow all users to select room members" on public.room_members;
drop policy if exists "Allow users to insert/update room members" on public.room_members;

-- rooms
create policy "rooms_select_members" on public.rooms for select to authenticated
  using (public.is_room_member(id) or owner_id = (select auth.uid()));
create policy "rooms_insert_self_owner" on public.rooms for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "rooms_update_members" on public.rooms for update to authenticated
  using (public.is_room_member(id)) with check (public.is_room_member(id));
create policy "rooms_delete_owner" on public.rooms for delete to authenticated
  using (public.is_room_owner(id));

-- readings
create policy "readings_select_members" on public.readings for select to authenticated
  using (public.is_room_member(room_id));
create policy "readings_insert_members" on public.readings for insert to authenticated
  with check (public.is_room_member(room_id));
create policy "readings_update_members" on public.readings for update to authenticated
  using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));
create policy "readings_delete_members" on public.readings for delete to authenticated
  using (public.is_room_member(room_id));

-- room_members: inserted only by trigger / accept_room_invite()
create policy "members_select_same_room" on public.room_members for select to authenticated
  using (public.is_room_member(room_id));
create policy "members_delete_owner_or_self" on public.room_members for delete to authenticated
  using (role <> 'owner' and (public.is_room_owner(room_id) or user_id = (select auth.uid())));

-- room_invites: managed by the room owner
create policy "invites_select_owner" on public.room_invites for select to authenticated
  using (public.is_room_owner(room_id));
create policy "invites_insert_owner" on public.room_invites for insert to authenticated
  with check (public.is_room_owner(room_id) and invited_by = (select auth.uid()));
create policy "invites_delete_owner" on public.room_invites for delete to authenticated
  using (public.is_room_owner(room_id));

-- ---------- 5. RPCs ----------
-- Caller's verified email (null if not confirmed)
create or replace function public.current_verified_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

-- Accept an invite link. Must be logged in with the invited email.
create or replace function public.accept_room_invite(p_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.room_invites;
  v_email text := public.current_verified_email();
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v from public.room_invites where token = p_token for update;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if v.accepted_at is not null then
    if v.accepted_by = auth.uid() then
      return v.room_id;
    end if;
    raise exception 'invite_used';
  end if;
  if v.expires_at < now() then
    raise exception 'invite_expired';
  end if;
  if v_email is null or lower(v.email) <> v_email then
    raise exception 'invite_email_mismatch';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (v.room_id, auth.uid(), 'admin')
  on conflict (room_id, user_id) do nothing;

  update public.room_invites set accepted_by = auth.uid(), accepted_at = now() where id = v.id;
  return v.room_id;
end;
$$;

-- Accept every pending invite addressed to the caller's verified email
create or replace function public.claim_my_room_invites()
returns setof text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := public.current_verified_email();
  v public.room_invites;
begin
  if auth.uid() is null or v_email is null then
    return;
  end if;

  for v in
    select * from public.room_invites
    where accepted_at is null and expires_at > now() and lower(email) = v_email
    for update
  loop
    insert into public.room_members (room_id, user_id, role)
    values (v.room_id, auth.uid(), 'admin')
    on conflict (room_id, user_id) do nothing;
    update public.room_invites set accepted_by = auth.uid(), accepted_at = now() where id = v.id;
    return next v.room_id;
  end loop;
end;
$$;

-- Members of a room with profile info (auth.users is not exposed directly)
create or replace function public.get_room_members(p_room_id text)
returns table (user_id uuid, role text, email text, display_name text, avatar_url text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.role, u.email::text,
         coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
         coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
         m.created_at
  from public.room_members m
  join auth.users u on u.id = m.user_id
  where m.room_id = p_room_id and public.is_room_member(p_room_id)
  order by (m.role = 'owner') desc, m.created_at;
$$;

revoke execute on function public.is_room_member(text) from public, anon;
revoke execute on function public.is_room_owner(text) from public, anon;
revoke execute on function public.current_verified_email() from public, anon;
revoke execute on function public.accept_room_invite(text) from public, anon;
revoke execute on function public.claim_my_room_invites() from public, anon;
revoke execute on function public.get_room_members(text) from public, anon;
revoke execute on function public.handle_new_room() from public, anon, authenticated;
grant execute on function public.is_room_member(text) to authenticated;
grant execute on function public.is_room_owner(text) to authenticated;
grant execute on function public.current_verified_email() to authenticated;
grant execute on function public.accept_room_invite(text) to authenticated;
grant execute on function public.claim_my_room_invites() to authenticated;
grant execute on function public.get_room_members(text) to authenticated;

-- ---------- 6. Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'room_members') then
    alter publication supabase_realtime add table public.room_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'readings') then
    alter publication supabase_realtime add table public.readings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;
