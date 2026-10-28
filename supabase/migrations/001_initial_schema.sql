-- NOTE: Supabase Storage buckets are NOT created via SQL.
-- Create these buckets in the Supabase Dashboard (Storage > Bucket) or via the API:
--   1. profile-images  (public, image uploads)
--   2. session-videos  (public, video uploads)
-- Set both to "Public" so getPublicUrl works for profile media.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Config table for configurable values (commission, cutoff, hold duration, grace window, thresholds, probation size)
create table config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now() not null
);

-- Profiles: public data about a user (dancer or coach)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  phone_verified boolean default false not null,
  role text not null default 'dancer' check (role in ('dancer', 'coach', 'admin')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Dancer profiles: extended profile fields visible publicly
create table dancer_profiles (
  id uuid primary key references users(id) on delete cascade,
  name text not null,
  bio text,
  profile_picture_url text,
  years_of_experience integer default 0 check (years_of_experience >= 0),
  is_new boolean default true not null, -- placeholder until ratings exist
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Dance styles with self-declared level
create table user_styles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  style text not null,
  level text not null check (level in ('beginner', 'improver', 'intermediate', 'advanced')),
  created_at timestamptz default now() not null,
  unique (user_id, style)
);

-- Media uploads (photos and short videos)
create table media (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('image', 'video')),
  duration_seconds integer,
  created_at timestamptz default now() not null
);

-- Blocks: user blocks another user
create table blocks (
  id uuid primary key default uuid_generate_v4(),
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now() not null,
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Reports: user reports another user or content
create table reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references users(id) on delete cascade,
  reported_user_id uuid references users(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz default now() not null
);

-- Seed default config values
insert into config (key, value, description) values
  ('commission_percent', '{"value": 15}', 'Platform commission on coach earnings'),
  ('hold_duration_minutes', '{"value": 15}', 'How long a paid slot is held before release'),
  ('grace_window_minutes', '{"value": 10}', 'Grace window after session start'),
  ('probation_size', '{"value": 5}', 'Minimum sessions before coach gets full rating'),
  ('min_attendees_to_confirm', '{"value": 3}', 'Minimum attendees to confirm a session'),
  ('max_video_duration_seconds', '{"value": 60}', 'Max video upload duration'),
  ('max_image_size_mb', '{"value": 5}', 'Max image upload size in MB');
