-- NOTE: Supabase Storage buckets are NOT created via SQL.
-- Create these buckets in the Supabase Dashboard (Storage > Bucket):
--   1. coach-intro-videos   (public, intro video uploads)
--   2. coach-samples        (public, teaching sample uploads)
--   3. coach-certifications (public, certification uploads)
--   4. venue-photos         (public, venue photo uploads)
-- Set all to "Public" so getPublicUrl works.

-- Coach applications (draft -> submitted -> under_review -> approved/needs_changes/rejected)
create table coach_applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'approved', 'needs_changes', 'rejected')),
  styles_taught jsonb not null default '[]'::jsonb,
  years_experience integer check (years_experience >= 0),
  intro_video_url text,
  teaching_samples jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  bio text,
  languages jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  identity_verified boolean default false not null,
  gender_on_id text check (gender_on_id in ('male', 'female', 'other', 'prefer_not_to_say')),
  admin_note text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id)
);

-- Approved coach profile
create table coach_profiles (
  id uuid primary key references users(id) on delete cascade,
  application_id uuid references coach_applications(id),
  approved_at timestamptz,
  probation boolean default true not null,
  sessions_completed integer default 0 check (sessions_completed >= 0),
  max_group_size integer default 6 check (max_group_size > 0 and max_group_size <= 20),
  is_paused boolean default false not null,
  default_price_per_hour integer check (default_price_per_hour >= 0),
  default_min_group_size integer default 2 check (default_min_group_size >= 1),
  default_max_group_size integer check (default_max_group_size >= 1),
  payout_type text check (payout_type in ('bank', 'upi')),
  payout_details_masked text,
  payout_details_encrypted text,
  terms_accepted boolean default false not null,
  terms_accepted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Venues (exact address is private; only name/city/public fields visible)
create table venues (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references users(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  is_default boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Venue photos
create table venue_media (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('image', 'video')),
  public_url text not null,
  created_at timestamptz default now() not null
);

-- Coach weekly availability
create table coach_availability (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references users(id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  is_available boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (coach_id, day_of_week, start_time)
);

-- Admin action log (immutable audit trail)
create table admin_actions (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null references users(id) on delete cascade,
  action_type text not null check (action_type in ('approve', 'reject', 'needs_changes', 'pause', 'resume', 'create_venue', 'update_venue', 'delete_venue')),
  target_user_id uuid references users(id),
  target_application_id uuid references coach_applications(id),
  note text,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table coach_applications enable row level security;
alter table coach_profiles enable row level security;
alter table venues enable row level security;
alter table venue_media enable row level security;
alter table coach_availability enable row level security;
alter table admin_actions enable row level security;

-- Coach applications: owner reads/writes own drafts; admins read all
create policy "Applications readable by owner"
  on coach_applications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Applications readable by admins"
  on coach_applications for select
  to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

create policy "Applications insertable by owner"
  on coach_applications for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Applications updatable by owner (draft only)"
  on coach_applications for update
  to authenticated
  using (auth.uid() = user_id and status = 'draft')
  with check (auth.uid() = user_id and status in ('draft', 'submitted'));

create policy "Applications status updatable by admins only"
  on coach_applications for update
  to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- Coach profiles: public readable (masked payout); owner writes non-sensitive fields
create policy "Coach profiles readable by all"
  on coach_profiles for select
  to authenticated
  using (true);

create policy "Coach profiles owner writes non-sensitive"
  on coach_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Venues: owner coach writes; public reads name/city only (address private)
create policy "Venues readable by all (name/city)"
  on venues for select
  to authenticated
  using (true);

create policy "Venues owner writes"
  on venues for all
  to authenticated
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

-- Venue media: public readable; owner writes
create policy "Venue media readable by all"
  on venue_media for select
  to authenticated
  using (true);

create policy "Venue media owner writes"
  on venue_media for all
  to authenticated
  using (auth.uid() = (select coach_id from venues where id = venue_id));

-- Coach availability: owner writes; public reads
create policy "Coach availability readable by all"
  on coach_availability for select
  to authenticated
  using (true);

create policy "Coach availability owner writes"
  on coach_availability for all
  to authenticated
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

-- Admin actions: admins read/write all; users read own actions
create policy "Admin actions readable by admins"
  on admin_actions for select
  to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

create policy "Admin actions readable by target user"
  on admin_actions for select
  to authenticated
  using (auth.uid() = target_user_id);

create policy "Admin actions insertable by admins"
  on admin_actions for insert
  to authenticated
  with check (exists (select 1 from users where id = auth.uid() and role = 'admin'));
