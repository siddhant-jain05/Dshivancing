-- ============================================================
-- Item 1/6 fix: Fix references to dropped payout_details_encrypted column
-- ============================================================

-- Fix approve_coach_application: remove payout_details_encrypted reference
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
    payout_type, payout_details_masked, terms_accepted
  ) values (
    v_application.user_id, v_application.id, now(), true, 0,
    6, false, null, null, null, null, false
  ) returning * into v_coach_profile;

  insert into admin_actions (
    admin_id, action_type, target_user_id, target_application_id, note
  ) values (
    auth.uid(), 'approve', v_application.user_id, v_application.id, p_admin_note
  );

  return v_application;
end;
$$;

-- Fix set_coach_payout_details: remove payout_details_encrypted reference
create or replace function set_coach_payout_details(
  p_coach_id uuid,
  p_payout_type text,
  p_payout_details text
) returns text
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
      payout_details_ciphertext = pgsodium_box_seal(p_payout_details),
      updated_at = now()
  where id = p_coach_id;

  return v_masked;
end;
$$;
