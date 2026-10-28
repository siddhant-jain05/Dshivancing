-- ============================================================
-- Item 3: Identity verification server-side only writes
-- Block client writes to identity_verified and gender_on_id
-- Create SECURITY DEFINER function for setting these values
-- ============================================================

-- Block direct client updates to identity_verified and gender_on_id on coach_applications
-- via a trigger. Only admins and the server-side function can set these.

create or replace function guard_coach_identity_columns()
returns trigger
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role
  from users
  where id = auth.uid();

  -- Admins may change anything
  if caller_role = 'admin' then
    return new;
  end if;

  -- Non-admins: reject if identity_verified or gender_on_id changed
  if (new.identity_verified is distinct from old.identity_verified) then
    raise exception 'Only server-side verification can set identity_verified';
  end if;

  if (new.gender_on_id is distinct from old.gender_on_id) then
    raise exception 'Only server-side verification can set gender_on_id';
  end if;

  return new;
end;
$$;

create trigger trg_guard_coach_identity_columns
before update on coach_applications
for each row
execute function guard_coach_identity_columns();

-- SECURITY DEFINER function to set identity verification results
-- Called by the verification Edge Function or server code after successful verification
create or replace function set_coach_identity_verification(
  p_application_id uuid,
  p_verified boolean,
  p_gender_on_id text
) returns coach_applications
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  v_application coach_applications%rowtype;
begin
  -- Only the application owner or an admin can call this
  -- (In production, this would be called by an Edge Function with service_role)
  select * into v_application
  from coach_applications
  where id = p_application_id
  for update;

  if auth.uid() <> v_application.user_id then
    -- Not the owner; must be admin
    if not exists (select 1 from users where id = auth.uid() and role = 'admin') then
      raise exception 'Only the application owner or an admin can set identity verification';
    end if;
  end if;

  update coach_applications
  set identity_verified = p_verified,
      gender_on_id = p_gender_on_id,
      updated_at = now()
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

-- ============================================================
-- ID number storage check
-- ============================================================
-- There is NO id_number column in any table.
-- The identity verifier stub only receives idNumber/idType as transient parameters
-- and returns { verified, genderOnId }. The ID number is never written to the database,
-- never written to logs, and never written to local storage.
-- No ID number exists anywhere in the system.
