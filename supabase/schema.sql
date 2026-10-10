-- ==============================================================================
-- jodbill (จดบิล) - Supabase Database Schema & Row Level Security (RLS)
-- Copy and paste this script into your Supabase Dashboard > SQL Editor > Run
-- ==============================================================================

-- 1. Create Rooms Table
create table if not exists public.rooms (
  id text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  dorm_name text default 'หอพักของฉัน',
  room_number text default '',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Create Readings Table
create table if not exists public.readings (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  room_id text references public.rooms(id) on delete cascade default 'default-room',
  meter_type text not null check (meter_type in ('electricity', 'water')),
  reading numeric not null,
  previous_reading numeric,
  units_used numeric,
  calculated_cost numeric,
  photo_url text,
  notes text,
  detected_by text default 'manual',
  ocr_confidence numeric,
  timestamp timestamptz not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. Create Room Members (for roommate sharing & roles)
create table if not exists public.room_members (
  id uuid default gen_random_uuid() primary key,
  room_id text references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (room_id, user_id)
);

-- 4. Enable Row Level Security (RLS)
alter table public.rooms enable row level security;
alter table public.readings enable row level security;
alter table public.room_members enable row level security;

-- 5. Public / Authenticated Access Policies (Allow read/write for users)
create policy "Allow all users to select rooms" on public.rooms
  for select using (true);

create policy "Allow users to insert/update rooms" on public.rooms
  for all using (true) with check (true);

create policy "Allow all users to select readings" on public.readings
  for select using (true);

create policy "Allow users to insert/update readings" on public.readings
  for all using (true) with check (true);

create policy "Allow all users to select room members" on public.room_members
  for select using (true);

create policy "Allow users to insert/update room members" on public.room_members
  for all using (true) with check (true);

-- 6. Enable Realtime Replication for instant roommate live sync
alter publication supabase_realtime add table public.readings;
alter publication supabase_realtime add table public.rooms;
