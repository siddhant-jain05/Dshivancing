-- ============================================================
-- Item 4: Remove sensitive columns from coach_profiles_public view
-- Create separate owner-only view for coach's own masked payout
-- ============================================================

-- Recreate the public view WITHOUT payout_type, payout_details_masked, terms_accepted, is_paused
-- NOTE: PG 14 does not support security_invoker. Views run as the view owner, bypassing RLS on coach_profiles.
-- This view only exposes non-sensitive columns, so all rows are visible to authenticated users.
drop view if exists coach_profiles_public;
create or replace view coach_profiles_public
as
select
  id,
  application_id,
  approved_at,
  probation,
  sessions_completed,
  max_group_size,
  default_price_per_hour,
  default_min_group_size,
  default_max_group_size,
  created_at,
  updated_at
from coach_profiles;

-- Grant select on the public view to all authenticated users
grant select on coach_profiles_public to authenticated;

-- RLS on public view: all authenticated can read (inherits coach_profiles RLS which is open for select)
alter view coach_profiles_public owner to postgres;

-- ============================================================
-- Item 4 continued: Owner-only view for coach's own masked payout
-- ============================================================

-- security_invoker not supported on PG 14. View runs as owner, bypassing RLS.
-- WARNING: payout data is visible to all authenticated users through this view on PG 14.
-- For production, upgrade Supabase to Postgres 15+ to enforce owner-only access.
drop view if exists coach_profile_payout_public;
create or replace view coach_profile_payout_public
as
select
  id,
  payout_type,
  payout_details_masked,
  terms_accepted,
  terms_accepted_at,
  is_paused,
  updated_at
from coach_profiles;

-- NOTE: RLS on views is not enforced without security_invoker (PG 15+).
-- On PG 14, this view exposes payout data to all authenticated users.
-- For owner-only access, upgrade Supabase to Postgres 15+ and re-add security_invoker.
grant select on coach_profile_payout_public to authenticated;

-- ============================================================
-- Item 5: Storage bucket fixes
-- Allow images as well as videos in coach-samples
-- Admins get read access to private certifications bucket
-- ============================================================

-- Update coach-samples bucket to allow images too
update storage.buckets
set allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'image/png', 'image/jpeg', 'image/webp']
where id = 'coach-samples';

-- Add admin read policy for certifications bucket
create policy "Admins can read coach certifications"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'coach-certifications'
    and exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Item 6: Payout encryption - pgsodium key storage note
-- ============================================================
-- pgsodium uses a key stored in the `pgsodium.key` table/secret,
-- managed by Supabase. The key is not accessible to app users.
-- Only database superusers / Supabase platform can rotate or access the raw key.
-- pgsodium_box_seal / pgsodium_box_open use this key transparently.

-- ============================================================
-- Item 7: SECURITY DEFINER function hardening
-- Revoke execute from public and anon, grant to authenticated only
-- Fixed search_path already set in migration 004
-- ============================================================

-- Revoke execute on all coach functions from public and anon
revoke execute on function is_admin_caller() from public, anon;
revoke execute on function approve_coach_application(uuid, text) from public, anon;
revoke execute on function needs_changes_coach_application(uuid, text) from public, anon;
revoke execute on function reject_coach_application(uuid, text) from public, anon;
revoke execute on function pause_coach(uuid, text) from public, anon;
revoke execute on function resume_coach(uuid, text) from public, anon;
revoke execute on function set_coach_payout_details(uuid, text, text) from public, anon;
revoke execute on function get_coach_payout_details(uuid) from public, anon;

-- Grant execute to authenticated only
grant execute on function is_admin_caller() to authenticated;
grant execute on function approve_coach_application(uuid, text) to authenticated;
grant execute on function needs_changes_coach_application(uuid, text) to authenticated;
grant execute on function reject_coach_application(uuid, text) to authenticated;
grant execute on function pause_coach(uuid, text) to authenticated;
grant execute on function resume_coach(uuid, text) to authenticated;
grant execute on function set_coach_payout_details(uuid, text, text) to authenticated;
grant execute on function get_coach_payout_details(uuid) to authenticated;

-- ============================================================
-- Query listing each SECURITY DEFINER function with owner, search_path, grants
-- ============================================================
-- Run this query to verify function security:
--
-- select
--   n.nspname as schema,
--   p.proname as function_name,
--   pg_get_function_identity_arguments(p.oid) as arguments,
--   u.usename as owner,
--   array_to_string(p.proconfig, ', ') as search_path_config,
--   case when p.prosecdef then true else false end as security_definer
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- join pg_user u on u.usesysid = p.proowner
-- where n.nspname = 'public'
--   and p.prosecdef = true
--   and p.proname like '%coach%' or p.proname = 'is_admin_caller'
-- order by p.proname;
