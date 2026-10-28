-- ============================================================
-- Phase 2 Hardening: Comprehensive RLS + Security Tests
-- Run against a live Supabase instance (local via `supabase start`
-- or against a real Supabase project).
--
-- Prerequisites: Migrations 001-009 must be applied.
-- ============================================================

\set ON_ERROR_STOP on

-- ============================================================
-- TEST HELPERS
-- ============================================================
-- To impersonate a user, set:
--   set role authenticated;
--   set config 'request.jwt.claims', '{"sub": "<uuid>", "role": "<dancer|coach|admin>"}';
--
-- auth.uid() reads from request.jwt.claims.sub
-- is_admin_caller() checks users.role = 'admin' where id = auth.uid()

-- Reset session config between tests
\set dancer_id '11111111-1111-1111-1111-111111111111'
\set coach_id '22222222-2222-2222-2222-222222222222'
\set admin_id '33333333-3333-3333-3333-333333333333'
\set app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa

-- ============================================================
-- SETUP: Insert test users into the users table
-- ============================================================

-- Run as postgres/superuser to insert test users
insert into users (id, phone, phone_verified, role, created_at, updated_at)
values
  (:'dancer_id', '+919999999991', true, 'dancer', now(), now()),
  (:'coach_id', '+919999999992', true, 'coach', now(), now()),
  (:'admin_id', '+919999999993', true, 'admin', now(), now())
on conflict (id) do nothing;

-- ============================================================
-- TEST 1: Role escalation attempt - non-admin cannot set role='admin'
-- ============================================================
-- Impersonate the dancer and try to update their own role to 'admin'
-- Expected: ERROR - trigger blocks role change

set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

update users set role = 'admin' where id = :'dancer_id';
-- Expected: ERROR: Only admins can change the role column

-- Verify role was NOT changed
select role from users where id = :'dancer_id';
-- Expected: 'dancer'

-- Also try phone_verified change
update users set phone_verified = true where id = :'dancer_id';
-- Expected: ERROR: Only admins can change phone_verified

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 2: Normal user cannot read other users' applications
-- ============================================================
-- Dancer inserts their own application
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

insert into coach_applications (id, user_id, status, styles_taught, bio)
values (:'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', :'dancer_id', 'draft', '["Bollywood"]'::jsonb, 'Test bio');

-- Now impersonate the coach and try to read the dancer's application
set config 'request.jwt.claims', '{"sub": ":'coach_id'", "role": "coach"}';

select count(*) as other_apps_visible from coach_applications where user_id = :'dancer_id';
-- Expected: 0 (coach cannot see dancer's application)

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 3: Applicant cannot edit submitted application (status change blocked)
-- ============================================================
-- Dancer updates their own draft to submitted
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

update coach_applications
set status = 'submitted', updated_at = now()
where id = :'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = :'dancer_id';

-- Now try to change status directly (should be blocked by RLS - not draft/needs_changes)
update coach_applications
set status = 'approved'
where id = :'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = :'dancer_id';
-- Expected: 0 rows affected (RLS blocks non-draft, non-needs_changes updates by owner)

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 4: Applicant CAN edit needs_changes application
-- ============================================================
-- Admin sets status to needs_changes
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'admin_id'", "role": "admin"}';

select needs_changes_coach_application(:'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fix your bio');

-- Dancer can now edit content (but not status)
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

update coach_applications
set bio = 'Updated bio'
where id = :'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = :'dancer_id' and status = 'needs_changes';
-- Expected: 1 row updated

-- Dancer tries to change status (should fail - owner can't change status)
update coach_applications
set status = 'submitted'
where id = :'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = :'dancer_id';
-- Expected: 0 rows affected (owner cannot change status)

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 5: Non-admin cannot execute admin functions
-- ============================================================
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

select approve_coach_application(:'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null);
-- Expected: ERROR: Only admins can approve coach applications

select reject_coach_application(:'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test');
-- Expected: ERROR: Only admins can reject coach applications

select pause_coach(:'dancer_id', null);
-- Expected: ERROR: Only admins can pause coaches

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 6: Admin can execute admin functions
-- ============================================================
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'admin_id'", "role": "admin"}';

select approve_coach_application(:'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null);
-- Expected: succeeds, returns row with status='approved'

-- Verify coach_profile was created
select probation, max_group_size, is_paused from coach_profiles where id = :'dancer_id';
-- Expected: probation=true, max_group_size=6, is_paused=false

-- Verify admin_actions was logged
select count(*) as approve_logged from admin_actions where action_type = 'approve' and target_application_id = :'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: 1

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 7: Non-admin cannot read admin_actions
-- ============================================================
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

select count(*) as admin_actions_visible from admin_actions;
-- Expected: 0 (dancer is not the target of any action, and not admin)

-- Even targeting themselves:
select count(*) as own_actions_visible from admin_actions where target_user_id = :'dancer_id';
-- Expected: depends on test data, but RLS restricts non-admin reads

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 8: Non-admin cannot read ciphertext or payout details
-- ============================================================
-- Insert payout data as coach
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'coach_id'", "role": "coach"}';

select set_coach_payout_details(:'coach_id', 'upi', 'coach@upi');
-- Expected: returns '***@upi'

-- Dancer tries to read coach's payout_details_masked
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

select payout_details_masked from coach_profiles where id = :'coach_id';
-- Expected: 0 rows (RLS blocks non-owner, non-admin reads)

-- Dancer tries to read ciphertext
select payout_details_ciphertext from coach_profiles where id = :'coach_id';
-- Expected: ERROR or 0 rows (RLS blocks read)

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 9: coach_profiles_public view does not expose ciphertext
-- ============================================================
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

-- Check columns of the public view
select column_name
from information_schema.columns
where table_name = 'coach_profiles_public'
order by ordinal_position;
-- Expected: payout_details_ciphertext NOT in list
-- Expected: payout_details_masked NOT in list (removed per Item 4)
-- Expected: terms_accepted NOT in list (removed per Item 4)
-- Expected: is_paused NOT in list (removed per Item 4)
-- Expected: payout_type NOT in list (removed per Item 4)

-- Try to select from public view (should work, showing only safe columns)
select * from coach_profiles_public where id = :'coach_id';
-- Expected: returns row WITHOUT payout columns

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 10: Admin can read full payout details (audited)
-- ============================================================
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'admin_id'", "role": "admin"}';

select get_coach_payout_details(:'coach_id');
-- Expected: returns plaintext payout details (e.g., 'coach@upi')

-- Verify audit row was written
select count(*) as payout_read_logged
from admin_actions
where action_type = 'read_payout' and target_user_id = :'coach_id';
-- Expected: 1

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 11: Non-admin cannot call get_coach_payout_details
-- ============================================================
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'dancer_id'", "role": "dancer"}';

select get_coach_payout_details(:'coach_id');
-- Expected: ERROR: Only admins can read full payout details

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 12: Admin actions logged for all outcomes
-- ============================================================
set role authenticated;
set config 'request.jwt.claims', '{"sub": ":'admin_id'", "role": "admin"}';

-- Count before
select count(*) as actions_before from admin_actions;

select needs_changes_coach_application(:'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'needs work');
select reject_coach_application(:'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'not suitable');

-- Count after - should have increased
select count(*) as actions_after from admin_actions;

-- Verify specific action types
select action_type, count(*) as cnt
from admin_actions
where target_application_id = :'app_id_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
group by action_type;

reset role;
reset config 'request.jwt.claims';

-- ============================================================
-- TEST 13: Public view of coach profiles excludes sensitive columns
-- ============================================================
-- Verify the view definition excludes payout columns
select column_name
from information_schema.columns
where table_name = 'coach_profiles_public'
and column_name in ('payout_type', 'payout_details_masked', 'terms_accepted', 'is_paused', 'payout_details_ciphertext');
-- Expected: 0 rows (none of these columns exist in the public view)

-- ============================================================
-- TEST 14: Storage bucket visibility
-- ============================================================
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('coach-intro-videos', 'coach-samples', 'coach-certifications', 'venue-photos');
-- Expected:
-- coach-intro-videos: public=true, limit=52428800, video types
-- coach-samples: public=true, limit=52428800, video+image types
-- coach-certifications: public=false, limit=10485760, pdf+image types
-- venue-photos: public=true, limit=5242880, image types

-- ============================================================
-- TEST 15: SECURITY DEFINER functions have fixed search_path and restricted grants
-- ============================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  u.usename as owner,
  case when p.prosecdef then true else false end as security_definer,
  array_to_string(p.proconfig, ', ') as search_path_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_user u on u.usesysid = p.proowner
where n.nspname = 'public'
  and p.prosecdef = true
  and (p.proname like '%coach%' or p.proname = 'is_admin_caller')
order by p.proname;
-- Expected: All functions have security_definer=true, search_path=public, owner=postgres

-- Check grants
select
  p.proname as function_name,
  grantee,
  privilege_type
from information_schema.routine_privileges rp
join pg_proc p on p.proname = rp.routine_name
where p.proname like '%coach%' or p.proname = 'is_admin_caller'
order by p.proname, grantee;
-- Expected: EXECUTE granted to 'authenticated', NOT to 'public' or 'anon'

-- ============================================================
-- END OF TESTS
-- ============================================================
select 'All RLS tests completed' as status;
