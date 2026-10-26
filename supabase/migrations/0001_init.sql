-- Closer core schema. Service role and these functions own money, streaks,
-- strikes, bans, drops and match creation. The client cannot write them.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  dob date,
  gender text,
  show_me text,
  intent text,
  area text,
  phone_hash text unique,
  verified boolean not null default false,
  hide_from_contacts boolean not null default true,
  paused boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  is_main boolean not null default false
);

create table public.voice_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  prompt text not null,
  storage_path text not null,
  seconds int not null check (seconds between 1 and 30)
);

create table public.preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  areas text[] not null default '{}',
  languages text[] not null default '{}',
  age_min int not null default 18,
  age_max int not null default 70,
  foods text[] not null default '{}'
);

create table public.contact_hashes (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  hash text not null,
  primary key (owner_id, hash)
);

create table public.contact_allowlist (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  hash text not null,
  primary key (owner_id, hash)
);

create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  primary key (blocker, blocked)
);

create table public.drops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  drop_date date not null,
  unique (user_id, drop_date)
);

create table public.drop_picks (
  drop_id uuid not null references public.drops (id) on delete cascade,
  person_id uuid not null references public.profiles (id),
  position int not null check (position between 1 and 3),
  primary key (drop_id, position)
);

create table public.likes (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);

create table public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  count int not null default 0,
  last_date date,
  freezes_left int not null default 2,
  freeze_month text not null default ''
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  person_id uuid not null references public.profiles (id),
  venue_id text not null,
  slot text not null,
  kind text not null,
  status text not null default 'upcoming',
  created_at timestamptz not null default now()
);

create table public.deposits (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  amount_inr int not null default 99,
  status text not null default 'unpaid',
  booked_at timestamptz
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.away_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  kind text not null,
  until date
);

create table public.debriefs (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  feel text not null,
  again text not null,
  note text not null default ''
);

create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  phone_hash text not null,
  confirmed boolean not null default false
);

create table public.safety_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  checked_in_at timestamptz,
  prompt_at timestamptz,
  answered_at timestamptz
);

create table public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  plan_id uuid references public.plans (id),
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id),
  against_id uuid references public.profiles (id),
  category text not null,
  severe boolean not null default false,
  detail text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.strikes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id),
  user_id uuid not null references public.profiles (id),
  category text not null,
  created_at timestamptz not null default now()
);

create table public.bans (
  user_id uuid primary key references public.profiles (id),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  role text not null,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create table public.gift_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  milestone int not null,
  gift text not null,
  address text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.voice_answers enable row level security;
alter table public.preferences enable row level security;
alter table public.contact_hashes enable row level security;
alter table public.contact_allowlist enable row level security;
alter table public.blocks enable row level security;
alter table public.drops enable row level security;
alter table public.drop_picks enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.streaks enable row level security;
alter table public.plans enable row level security;
alter table public.deposits enable row level security;
alter table public.messages enable row level security;
alter table public.away_status enable row level security;
alter table public.debriefs enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.safety_sessions enable row level security;
alter table public.sos_events enable row level security;
alter table public.reports enable row level security;
alter table public.strikes enable row level security;
alter table public.bans enable row level security;
alter table public.audit_log enable row level security;
alter table public.gift_claims enable row level security;

create or replace function public.is_staff(role_name text)
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'roles') @> to_jsonb(role_name), false);
$$;

create policy profiles_own on public.profiles
  for select using (id = auth.uid() or (
    verified = true
    and deleted_at is null
    and paused = false
    and not exists (select 1 from public.bans b where b.user_id = profiles.id)
    and not exists (
      select 1 from public.blocks blk
      where (blk.blocker = auth.uid() and blk.blocked = profiles.id)
         or (blk.blocker = profiles.id and blk.blocked = auth.uid())
    )
    and not exists (
      select 1
      from public.profiles me
      join public.contact_hashes h on h.owner_id = profiles.id and h.hash = me.phone_hash
      where me.id = auth.uid()
        and profiles.hide_from_contacts
        and not exists (
          select 1 from public.contact_allowlist a
          where a.owner_id = profiles.id and a.hash = me.phone_hash
        )
    )
  ));

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.verified is distinct from old.verified
     or new.phone_hash is distinct from old.phone_hash
  then
    raise exception 'protected field';
  end if;
  return new;
end;
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

create policy photos_read on public.profile_photos
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = user_id and p.verified)
  );
create policy photos_write on public.profile_photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy voice_own on public.voice_answers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy prefs_own on public.preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy hashes_own on public.contact_hashes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy allow_own on public.contact_allowlist
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy blocks_own on public.blocks
  for all using (blocker = auth.uid()) with check (blocker = auth.uid());

create policy drops_own on public.drops
  for select using (user_id = auth.uid());

create policy picks_own on public.drop_picks
  for select using (exists (select 1 from public.drops d where d.id = drop_id and d.user_id = auth.uid()));

create policy likes_own on public.likes
  for select using (from_id = auth.uid() or to_id = auth.uid());
create policy likes_insert on public.likes
  for insert with check (from_id = auth.uid());

create policy matches_own on public.matches
  for select using (user_a = auth.uid() or user_b = auth.uid());

create policy streaks_read on public.streaks
  for select using (user_id = auth.uid());

create policy plans_own on public.plans
  for select using (owner_id = auth.uid() or person_id = auth.uid());

create policy deposits_read on public.deposits
  for select using (exists (
    select 1 from public.plans p where p.id = plan_id and (p.owner_id = auth.uid() or p.person_id = auth.uid())
  ));

create policy messages_read on public.messages
  for select using (exists (
    select 1 from public.plans p where p.id = plan_id and (p.owner_id = auth.uid() or p.person_id = auth.uid())
  ));

create policy away_own on public.away_status
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy debrief_own on public.debriefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy trusted_own on public.trusted_contacts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy safety_own on public.safety_sessions
  for select using (user_id = auth.uid() or public.is_staff('safety'));

create policy sos_own on public.sos_events
  for select using (user_id = auth.uid() or public.is_staff('safety'));

create policy reports_own on public.reports
  for select using (reporter_id = auth.uid() or public.is_staff('safety'));
create policy reports_insert on public.reports
  for insert with check (reporter_id = auth.uid());

create policy strikes_staff on public.strikes
  for select using (public.is_staff('safety') or user_id = auth.uid());

create policy bans_staff on public.bans
  for select using (public.is_staff('safety') or user_id = auth.uid());

create policy audit_staff on public.audit_log
  for select using (public.is_staff('safety') or public.is_staff('ops') or public.is_staff('finance'));

create policy gifts_own on public.gift_claims
  for select using (user_id = auth.uid() or public.is_staff('finance'));
create policy gifts_insert on public.gift_claims
  for insert with check (user_id = auth.uid());

-- No client insert policies on drops, matches, streaks, deposits, strikes, bans, messages.
-- Those go through the functions below.

create or replace function public.create_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.likes l where l.from_id = new.to_id and l.to_id = new.from_id) then
    insert into public.matches (user_a, user_b)
    values (least(new.from_id, new.to_id), greatest(new.from_id, new.to_id))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger likes_match
  after insert on public.likes
  for each row execute function public.create_match();

create or replace function public.create_plan(person uuid, venue text, slot text, kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  open_count int;
  plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not exists (
    select 1 from public.matches m
    where (m.user_a = auth.uid() and m.user_b = person) or (m.user_b = auth.uid() and m.user_a = person)
  ) then
    raise exception 'mutual like required';
  end if;
  select count(*) into open_count from public.plans p
    where p.owner_id = auth.uid() and p.status = 'upcoming';
  if open_count >= 3 then
    raise exception 'open plan limit';
  end if;
  insert into public.plans (owner_id, person_id, venue_id, slot, kind)
  values (auth.uid(), person, venue, slot, kind)
  returning id into plan_id;
  insert into public.deposits (plan_id) values (plan_id);
  return plan_id;
end;
$$;

create or replace function public.record_drop_open()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  row public.streaks;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  insert into public.streaks (user_id, last_date, count)
  values (auth.uid(), today, 1)
  on conflict (user_id) do nothing;
  select * into row from public.streaks where user_id = auth.uid() for update;
  if row.last_date = today then
    return row.count;
  end if;
  if row.last_date = today - 1 then
    update public.streaks set count = count + 1, last_date = today where user_id = auth.uid() returning count into row.count;
    return row.count;
  end if;
  update public.streaks set count = 1, last_date = today where user_id = auth.uid();
  return 1;
end;
$$;

revoke all on function public.create_plan(uuid, text, text, text) from public;
revoke all on function public.record_drop_open() from public;
grant execute on function public.create_plan(uuid, text, text, text) to authenticated;
grant execute on function public.record_drop_open() to authenticated;
