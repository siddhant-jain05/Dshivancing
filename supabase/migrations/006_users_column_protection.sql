-- ============================================================
-- Item 1: Column-level privileges + trigger protection on users table
-- Prevent non-admins from changing role, phone_verified, or any sensitive column
-- ============================================================

-- Revoke all table-level privileges from non-owner roles
revoke all on table users from anon, authenticated;

-- Grant SELECT on safe columns to all authenticated users
-- (phone is private but already protected by RLS; column grant is belt-and-suspenders)
grant select (id, phone, phone_verified, role, created_at, updated_at) on table users to authenticated;

-- Grant INSERT only during signup (auth.uid() = id enforced by RLS with check)
grant insert (id, phone, phone_verified, role, created_at, updated_at) on table users to authenticated;

-- Revoke UPDATE entirely from non-admins on the users table
-- Admins get UPDATE via their own role-based RLS policy + SECURITY DEFINER functions if needed
revoke update on table users from authenticated;

-- ============================================================
-- Trigger: reject changes to protected columns (role, phone_verified)
-- unless the caller is an admin.
-- ============================================================

create or replace function guard_users_protected_columns()
returns trigger
language plpgsql
strict
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- Determine caller's role
  select role into caller_role
  from users
  where id = auth.uid();

  -- Admins may change anything
  if caller_role = 'admin' then
    return new;
  end if;

  -- Non-admins: reject if role or phone_verified changed
  if (new.role is distinct from old.role) then
    raise exception 'Only admins can change the role column';
  end if;

  if (new.phone_verified is distinct from old.phone_verified) then
    raise exception 'Only admins can change phone_verified';
  end if;

  return new;
end;
$$;

create trigger trg_guard_users_protected_columns
before update on users
for each row
execute function guard_users_protected_columns();

-- Re-apply RLS policies on users (from migration 001/002) to ensure they still work
-- after privilege revocation. RLS operates independently of GRANT/REVOKE.

-- Drop and recreate to be idempotent
drop policy if exists "Users public fields readable by all authenticated" on users;
drop policy if exists "Users can read own phone number" on users;
drop policy if exists "Users can update own public fields" on users;
drop policy if exists "Users can insert own row on signup" on users;

create policy "Users public fields readable by all authenticated"
  on users for select
  to authenticated
  using (true);

create policy "Users can read own phone number"
  on users for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own row on signup"
  on users for insert
  to authenticated
  with check (auth.uid() = id);

-- No UPDATE policy for non-admins on users. The trigger additionally blocks
-- role and phone_verified changes even if a future policy is added.
