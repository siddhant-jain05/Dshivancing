-- Enable pgsodium extension for field-level encryption
create extension if not exists "pgsodium";

-- ============================================================
-- Database functions for coach application lifecycle
-- All are SECURITY DEFINER: they run with the function owner's
-- privileges but explicitly check that the caller is an admin.
-- ============================================================

create or replace function is_admin_caller() returns boolean
language plpgsql
strict
as $$
begin
  return exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- Approve a coach application: status -> approved, create coach_profile (probation), log admin action
create or replace function approve_coach_application(
  p_application_id uuid,
  p_admin_note text default null
) returns coach_applications
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  v_application coach_applications%rowtype;
  v_coach_profile coach_profiles%rowtype;
begin
  if not is_admin_caller() then
    raise exception 'Only admins can approve coach applications';
  end if;

  select * into v_application
  from coach_applications
  where id = p_application_id
  for update;

  if v_application.status not in ('submitted', 'under_review', 'needs_changes') then
    raise exception 'Application cannot be approved from status: %', v_application.status;
  end if;

  update coach_applications
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now(),
      admin_note = p_admin_note
  where id = p_application_id
  returning * into v_application;

  insert into coach_profiles (
    id, application_id, approved_at, probation, sessions_completed,
    max_group_size, is_paused, default_price_per_hour,
    default_min_group_size, default_max_group_size,
    payout_type, payout_details_masked, payout_details_encrypted,
    terms_accepted
  ) values (
    v_application.user_id, v_application.id, now(), true, 0,
    6, false, null, null, null, null, null, null, false
  ) returning * into v_coach_profile;

  insert into admin_actions (
    admin_id, action_type, target_user_id, target_application_id, note
  ) values (
    auth.uid(), 'approve', v_application.user_id, v_application.id, p_admin_note
  );

  return v_application;
end;
$$;

-- Needs changes: status -> needs_changes, store admin note, log action
create or replace function needs_changes_coach_application(
  p_application_id uuid,
  p_admin_note text
) returns coach_applications
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  v_application coach_applications%rowtype;
begin
  if not is_admin_caller() then
    raise exception 'Only admins can request changes to coach applications';
  end if;

  if p_admin_note is null or trim(p_admin_note) = '' then
    raise exception 'admin_note is required for needs_changes';
  end if;

  select * into v_application
  from coach_applications
  where id = p_application_id
  for update;

  if v_application.status not in ('submitted', 'under_review', 'needs_changes', 'rejected') then
    raise exception 'Application cannot transition to needs_changes from status: %', v_application.status;
  end if;

  update coach_applications
  set status = 'needs_changes',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now(),
      admin_note = p_admin_note
  where id = p_application_id
  returning * into v_application;

  insert into admin_actions (
    admin_id, action_type, target_user_id, target_application_id, note
  ) values (
    auth.uid(), 'needs_changes', v_application.user_id, v_application.id, p_admin_note
  );

  return v_application;
end;
$$;

-- Reject: status -> rejected, store reason, log action
create or replace function reject_coach_application(
  p_application_id uuid,
  p_reason text
) returns coach_applications
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  v_application coach_applications%rowtype;
begin
  if not is_admin_caller() then
    raise exception 'Only admins can reject coach applications';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'reason is required for rejection';
  end if;

  select * into v_application
  from coach_applications
  where id = p_application_id
  for update;

  if v_application.status not in ('submitted', 'under_review', 'needs_changes') then
    raise exception 'Application cannot be rejected from status: %', v_application.status;
  end if;

  update coach_applications
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now(),
      admin_note = p_reason
  where id = p_application_id
  returning * into v_application;

  insert into admin_actions (
    admin_id, action_type, target_user_id, target_application_id, note
  ) values (
    auth.uid(), 'reject', v_application.user_id, v_application.id, p_reason
  );

  return v_application;
end;
$$;

-- Pause coach: is_paused = true, log action
create or replace function pause_coach(
  p_coach_id uuid,
  p_admin_note text default null
) returns coach_profiles
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  v_profile coach_profiles%rowtype;
begin
  if not is_admin_caller() then
    raise exception 'Only admins can pause coaches';
  end if;

  update coach_profiles
  set is_paused = true,
      updated_at = now()
  where id = p_coach_id
  returning * into v_profile;

  insert into admin_actions (
    admin_id, action_type, target_user_id, note
  ) values (
    auth.uid(), 'pause', p_coach_id, p_admin_note
  );

  return v_profile;
end;
$$;

-- Resume coach: is_paused = false, log action
create or replace function resume_coach(
  p_coach_id uuid,
  p_admin_note text default null
) returns coach_profiles
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  v_profile coach_profiles%rowtype;
begin
  if not is_admin_caller() then
    raise exception 'Only admins can resume coaches';
  end if;

  update coach_profiles
  set is_paused = false,
      updated_at = now()
  where id = p_coach_id
  returning * into v_profile;

  insert into admin_actions (
    admin_id, action_type, target_user_id, note
  ) values (
    auth.uid(), 'resume', p_coach_id, p_admin_note
  );

  return v_profile;
end;
$$;

-- ============================================================
-- Payout encryption: write-only from client, encrypted at rest
-- ============================================================

-- Add encrypted column and mask function
alter table coach_profiles
  add column if not exists payout_details_ciphertext bytea;

-- Function to encrypt and store payout details (client calls this, never reads back plaintext)
create or replace function set_coach_payout_details(
  p_coach_id uuid,
  p_payout_type text,
  p_payout_details text
) returns text  -- returns masked version only
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  v_masked text;
begin
  if auth.uid() <> p_coach_id then
    raise exception 'Coach can only set their own payout details';
  end if;

  if p_payout_type = 'upi' then
    v_masked := '***@' || split_part(p_payout_details, '@', 2);
  else
    v_masked := '****' || right(p_payout_details, 4);
  end if;

  update coach_profiles
  set payout_type = p_payout_type,
      payout_details_masked = v_masked,
      payout_details_encrypted = null,  -- legacy column cleared
      payout_details_ciphertext = pgsodium_box_seal(p_payout_details),
      updated_at = now()
  where id = p_coach_id;

  return v_masked;
end;
$$;

-- Admin-only function to read full payout details (audited)
create or replace function get_coach_payout_details(
  p_coach_id uuid
) returns text
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  v_plaintext text;
begin
  if not is_admin_caller() then
    raise exception 'Only admins can read full payout details';
  end if;

  select pgsodium_box_open(payout_details_ciphertext) into v_plaintext
  from coach_profiles
  where id = p_coach_id;

  -- Audit the read
  insert into admin_actions (
    admin_id, action_type, target_user_id, note
  ) values (
    auth.uid(), 'read_payout', p_coach_id, 'Read full payout details for coach ' || p_coach_id
  );

  return v_plaintext;
end;
$$;

-- ============================================================
-- Masked coach profile view (public-readable, no private fields)
-- ============================================================

create or replace view coach_profiles_public as
select
  id,
  application_id,
  approved_at,
  probation,
  sessions_completed,
  max_group_size,
  is_paused,
  default_price_per_hour,
  default_min_group_size,
  default_max_group_size,
  payout_type,
  payout_details_masked,
  terms_accepted,
  terms_accepted_at,
  created_at,
  updated_at
from coach_profiles;

-- ============================================================
-- Storage buckets with policies and size limits
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('coach-intro-videos', 'coach-intro-videos', true, 52428800, ARRAY['video/mp4', 'video/webm']),
  ('coach-samples', 'coach-samples', true, 52428800, ARRAY['video/mp4', 'video/webm']),
  ('coach-certifications', 'coach-certifications', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('venue-photos', 'venue-photos', true, 5242880, ARRAY['image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Storage policies
create policy "Coach intro videos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'coach-intro-videos');

create policy "Coach samples are publicly readable"
  on storage.objects for select
  using (bucket_id = 'coach-samples');

create policy "Coach certifications are private (owner read only)"
  on storage.objects for select
  using (bucket_id = 'coach-certifications' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Venue photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

create policy "Users can upload to their own application folder"
  on storage.objects for insert
  with check (
    bucket_id in ('coach-intro-videos', 'coach-samples', 'coach-certifications')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can upload venue photos for their own venues"
  on storage.objects for insert
  with check (
    bucket_id = 'venue-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update/delete their own uploads"
  on storage.objects for update
  using (
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own uploads"
  on storage.objects for delete
  using (
    auth.uid()::text = (storage.foldername(name))[1]
  );
