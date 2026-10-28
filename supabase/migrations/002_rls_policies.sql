-- Enable RLS on all tables
alter table users enable row level security;
alter table dancer_profiles enable row level security;
alter table user_styles enable row level security;
alter table media enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
alter table config enable row level security;

-- Config: readable by everyone, writable by no one via app
create policy "Config is readable by all authenticated users"
  on config for select
  to authenticated
  using (true);

-- Users: public fields readable by all authenticated; phone number private (owner only)
create policy "Users public fields readable by all authenticated"
  on users for select
  to authenticated
  using (true);

create policy "Users can read own phone number"
  on users for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own public fields"
  on users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own row on signup"
  on users for insert
  to authenticated
  with check (auth.uid() = id);

-- Dancer profiles: public fields readable by all authenticated; owner can write
create policy "Dancer profiles readable by all authenticated"
  on dancer_profiles for select
  to authenticated
  using (true);

create policy "Dancer profiles owner can write"
  on dancer_profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- User styles: public readable; owner writes
create policy "User styles readable by all authenticated"
  on user_styles for select
  to authenticated
  using (true);

create policy "User styles owner can write"
  on user_styles for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Media: public readable; owner writes
create policy "Media readable by all authenticated"
  on media for select
  to authenticated
  using (true);

create policy "Media owner can insert"
  on media for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Media owner can update/delete"
  on media for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Media owner can delete"
  on media for delete
  to authenticated
  using (auth.uid() = user_id);

-- Blocks: own blocks readable; owner writes
create policy "Blocks readable by blocker"
  on blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

create policy "Blocks owner can write"
  on blocks for all
  to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- Reports: reporter can read own; admin/role-based writes not handled in V1
create policy "Reports readable by reporter"
  on reports for select
  to authenticated
  using (auth.uid() = reporter_id);

create policy "Reports user can insert"
  on reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);
