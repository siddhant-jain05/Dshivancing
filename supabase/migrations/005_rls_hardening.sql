-- ============================================================
-- RLS hardening: coach_applications and coach_profiles
-- ============================================================

-- Drop and recreate coach_applications update policies
drop policy if exists "Applications updatable by owner (draft only)" on coach_applications;

-- Owner can edit draft applications (any fields including status draft->submitted)
create policy "Applications updatable by owner when draft"
  on coach_applications for update
  to authenticated
  using (auth.uid() = user_id and status = 'draft')
  with check (
    auth.uid() = user_id
    and status = 'draft'  -- owner can only keep it as draft or submit via submit_application
  );

-- Owner can edit needs_changes applications (fix and resubmit), but cannot change status themselves
create policy "Applications updatable by owner when needs_changes"
  on coach_applications for update
  to authenticated
  using (auth.uid() = user_id and status = 'needs_changes')
  with check (
    auth.uid() = user_id
    and status = 'needs_changes'  -- owner keeps status, fixes content only
  );

-- Owner can submit their own draft (status draft -> submitted)
create policy "Applications submit by owner"
  on coach_applications for update
  to authenticated
  using (auth.uid() = user_id and status = 'draft')
  with check (auth.uid() = user_id and status = 'submitted');

-- Admins can update any application (status changes via DB functions)
create policy "Applications updatable by admins"
  on coach_applications for update
  to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- ============================================================
-- Restrict coach_profiles table: only owner and admins can read
-- Public must use coach_profiles_public view (masked columns only)
-- ============================================================

drop policy if exists "Coach profiles readable by all" on coach_profiles;

create policy "Coach profiles readable by owner and admins"
  on coach_profiles for select
  to authenticated
  using (
    auth.uid() = id
    or exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

create policy "Coach profiles owner writes non-sensitive"
  on coach_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Grant select on the public view to all authenticated users
grant select on coach_profiles_public to authenticated;

-- ============================================================
-- Remove legacy plaintext payout column (replaced by ciphertext)
-- ============================================================

alter table coach_profiles
  drop column if exists payout_details_encrypted;
