-- Database rules from docs/Closer_Cursor_Review_and_Plan.md.
-- Fixes 1, 3, 4, 6, 7 (schema only; no Razorpay webhook), 8, 9, 11, 12, 13, 14, 15, 16, 18.
-- 0001_init.sql is unchanged.

-- ---------------------------------------------------------------------------
-- Columns and safety-evidence foreign keys (fixes 6, 7, 8, 12, 13, 15, 16)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column closer_plus boolean not null default false;

alter table public.plans
  add column booked_at timestamptz,
  add column kept_by_owner boolean not null default false,
  add column kept_by_person boolean not null default false;

alter table public.deposits
  add column payment_id text;

create unique index deposits_payment_id_key on public.deposits (payment_id)
  where payment_id is not null;

alter table public.streaks
  add column frozen_by_away boolean not null default false;

alter table public.reports
  add column source text not null default 'user' check (source in ('user', 'ai'));

alter table public.gift_claims
  add constraint gift_claims_user_milestone unique (user_id, milestone);

alter table public.trusted_contacts
  add column confirm_token text unique;

-- Rooms or Play can also authorise a like. The client cannot insert this.
create table public.social_connections (
  user_id uuid not null references public.profiles (id) on delete cascade,
  person_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('room', 'play')),
  primary key (user_id, person_id)
);

alter table public.social_connections enable row level security;

-- Account deletion keeps safety evidence and drops personal rows.
-- reports.against_id, strikes.user_id, bans.user_id, sos_events.user_id and
-- safety_sessions.user_id keep the deleted user's id with no foreign key.
-- Personal rows cascade. Plans owned by the user cascade. A plan where the
-- user was the guest keeps the row and clears person_id.

alter table public.drop_picks drop constraint drop_picks_person_id_fkey;
alter table public.drop_picks
  add constraint drop_picks_person_id_fkey
  foreign key (person_id) references public.profiles (id) on delete cascade;

alter table public.plans alter column person_id drop not null;
alter table public.plans drop constraint plans_person_id_fkey;
alter table public.plans
  add constraint plans_person_id_fkey
  foreign key (person_id) references public.profiles (id) on delete set null;

alter table public.messages alter column sender_id drop not null;
alter table public.messages drop constraint messages_sender_id_fkey;
alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles (id) on delete set null;

alter table public.debriefs drop constraint debriefs_user_id_fkey;
alter table public.debriefs
  add constraint debriefs_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.gift_claims drop constraint gift_claims_user_id_fkey;
alter table public.gift_claims
  add constraint gift_claims_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.safety_sessions drop constraint safety_sessions_user_id_fkey;
alter table public.safety_sessions alter column plan_id drop not null;
alter table public.safety_sessions drop constraint safety_sessions_plan_id_fkey;
alter table public.safety_sessions
  add constraint safety_sessions_plan_id_fkey
  foreign key (plan_id) references public.plans (id) on delete set null;

alter table public.sos_events drop constraint sos_events_user_id_fkey;
alter table public.sos_events drop constraint sos_events_plan_id_fkey;
alter table public.sos_events
  add constraint sos_events_plan_id_fkey
  foreign key (plan_id) references public.plans (id) on delete set null;

alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;
alter table public.reports drop constraint reports_against_id_fkey;

alter table public.strikes drop constraint strikes_user_id_fkey;
alter table public.bans drop constraint bans_user_id_fkey;

create unique index strikes_one_per_report on public.strikes (report_id);

-- ---------------------------------------------------------------------------
-- Helpers. security definer so policies on profiles do not recurse (fix 1).
-- ---------------------------------------------------------------------------

create or replace function public.is_banned(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.bans where user_id = uid);
$$;

create or replace function public.my_phone_hash()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phone_hash from public.profiles where id = auth.uid();
$$;

create or replace function public.viewer_is_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select verified from public.profiles where id = auth.uid() and deleted_at is null), false);
$$;

create or replace function public.hidden_by_contacts(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.hide_from_contacts
      and public.my_phone_hash() is not null
      and exists (
        select 1 from public.contact_hashes h
        where h.owner_id = p.id and h.hash = public.my_phone_hash()
      )
      and not exists (
        select 1 from public.contact_allowlist a
        where a.owner_id = p.id and a.hash = public.my_phone_hash()
      )
  );
$$;

create or replace function public.profile_is_visible(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target
      and p.id is distinct from auth.uid()
      and p.verified
      and p.deleted_at is null
      and p.paused = false
      and not public.is_banned(p.id)
      and not exists (
        select 1 from public.blocks blk
        where (blk.blocker = auth.uid() and blk.blocked = p.id)
           or (blk.blocker = p.id and blk.blocked = auth.uid())
      )
      and not public.hidden_by_contacts(p.id)
  );
$$;

create or replace function public.assert_active()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if public.is_banned(auth.uid()) then
    raise exception 'banned';
  end if;
end;
$$;

-- Postgres rejects current_date inside a CHECK because it is not immutable.
-- dob_is_adult is the same predicate: dob <= current_date - interval '18 years'.
create or replace function public.dob_is_adult(dob date)
returns boolean
language sql
immutable
as $$
  select dob is null or dob <= (current_date - interval '18 years');
$$;

alter table public.profiles
  add constraint profiles_adult check (public.dob_is_adult(dob));

create or replace function public.enforce_adult_dob()
returns trigger
language plpgsql
as $$
begin
  if new.dob is not null and not public.dob_is_adult(new.dob) then
    raise exception 'under 18';
  end if;
  return new;
end;
$$;

create trigger profiles_adult
  before insert or update on public.profiles
  for each row execute function public.enforce_adult_dob();

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
     or (old.verified and new.dob is distinct from old.dob)
  then
    raise exception 'protected field';
  end if;
  return new;
end;
$$;

create or replace function public.protect_report_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.status is distinct from 'open' then
    raise exception 'status is server owned';
  end if;
  new.source := 'user';
  return new;
end;
$$;

create trigger reports_protect_insert
  before insert on public.reports
  for each row execute function public.protect_report_insert();

create or replace function public.protect_trusted_confirmed()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role'
     or coalesce(current_setting('closer.trusted_confirm', true), '') = 'yes'
  then
    return new;
  end if;
  if tg_op = 'INSERT' and new.confirmed then
    raise exception 'confirm via link';
  end if;
  if tg_op = 'UPDATE' and new.confirmed is distinct from old.confirmed then
    raise exception 'confirm via link';
  end if;
  return new;
end;
$$;

create trigger trusted_confirm_guard
  before insert or update on public.trusted_contacts
  for each row execute function public.protect_trusted_confirmed();

-- Paid is the only transition that opens the 48-hour clock (fix 6 and 7).
create or replace function public.sync_booked_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    new.booked_at := coalesce(new.booked_at, now());
    update public.plans
      set booked_at = coalesce(booked_at, new.booked_at)
      where id = new.plan_id;
  end if;
  return new;
end;
$$;

create trigger deposits_booked_at
  before insert or update on public.deposits
  for each row execute function public.sync_booked_at();

-- ---------------------------------------------------------------------------
-- Policies (fixes 1, 3, 4, 11, 16)
-- ---------------------------------------------------------------------------

drop policy profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for select using (
    id = auth.uid()
    or (
      public.viewer_is_verified()
      and not public.is_banned(auth.uid())
      and public.profile_is_visible(id)
    )
  );

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (id = auth.uid() and not public.is_banned(auth.uid()))
  with check (id = auth.uid() and not public.is_banned(auth.uid()));

drop policy photos_read on public.profile_photos;
create policy photos_read on public.profile_photos
  for select using (
    user_id = auth.uid()
    or (
      public.viewer_is_verified()
      and not public.is_banned(auth.uid())
      and public.profile_is_visible(user_id)
    )
  );

drop policy photos_write on public.profile_photos;
create policy photos_write on public.profile_photos
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy voice_own on public.voice_answers;
create policy voice_own on public.voice_answers
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy prefs_own on public.preferences;
create policy prefs_own on public.preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy hashes_own on public.contact_hashes;
create policy hashes_own on public.contact_hashes
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy allow_own on public.contact_allowlist;
create policy allow_own on public.contact_allowlist
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy blocks_own on public.blocks;
create policy blocks_own on public.blocks
  for all
  using (blocker = auth.uid())
  with check (blocker = auth.uid() and not public.is_banned(auth.uid()));

drop policy likes_insert on public.likes;

drop policy away_own on public.away_status;
create policy away_own on public.away_status
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_banned(auth.uid()));

drop policy debrief_own on public.debriefs;
create policy debrief_own on public.debriefs
  for all
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.plans p
      where p.id = plan_id and (p.owner_id = auth.uid() or p.person_id = auth.uid())
    )
  )
  with check (
    user_id = auth.uid()
    and not public.is_banned(auth.uid())
    and exists (
      select 1 from public.plans p
      where p.id = plan_id and (p.owner_id = auth.uid() or p.person_id = auth.uid())
    )
  );

drop policy trusted_own on public.trusted_contacts;
create policy trusted_select on public.trusted_contacts
  for select using (user_id = auth.uid());
create policy trusted_insert on public.trusted_contacts
  for insert with check (
    user_id = auth.uid()
    and confirmed = false
    and not public.is_banned(auth.uid())
  );
create policy trusted_update on public.trusted_contacts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_banned(auth.uid()));
create policy trusted_delete on public.trusted_contacts
  for delete using (user_id = auth.uid());

drop policy reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (
    reporter_id = auth.uid()
    and status = 'open'
    and not public.is_banned(auth.uid())
  );

drop policy gifts_insert on public.gift_claims;

create policy connections_read on public.social_connections
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.send_like(person uuid, note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_active();
  if person is null or person = auth.uid() then
    raise exception 'unavailable';
  end if;
  if public.is_banned(person) then
    raise exception 'unavailable';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = person and p.verified and p.deleted_at is null and p.paused = false
  ) then
    raise exception 'unavailable';
  end if;
  if exists (
    select 1 from public.blocks blk
    where (blk.blocker = auth.uid() and blk.blocked = person)
       or (blk.blocker = person and blk.blocked = auth.uid())
  ) then
    raise exception 'blocked';
  end if;
  if public.hidden_by_contacts(person) then
    raise exception 'hidden';
  end if;
  if not (
    exists (
      select 1
      from public.drop_picks dp
      join public.drops d on d.id = dp.drop_id
      where d.user_id = auth.uid() and dp.person_id = person
    )
    or exists (
      select 1 from public.social_connections c
      where c.user_id = auth.uid() and c.person_id = person
    )
  ) then
    raise exception 'not in drop';
  end if;
  insert into public.likes (from_id, to_id, note)
  values (auth.uid(), person, coalesce(note, ''));
end;
$$;

create or replace function public.create_plan(person uuid, venue text, slot text, kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  open_count int;
  plan_id uuid;
  cap int;
begin
  perform public.assert_active();
  if person is null or person = auth.uid() then
    raise exception 'unavailable';
  end if;
  if public.is_banned(person) then
    raise exception 'unavailable';
  end if;
  if not exists (
    select 1 from public.matches m
    where (m.user_a = auth.uid() and m.user_b = person)
       or (m.user_b = auth.uid() and m.user_a = person)
  ) then
    raise exception 'mutual like required';
  end if;
  if exists (
    select 1 from public.plans p
    where p.status = 'upcoming'
      and (
        (p.owner_id = auth.uid() and p.person_id = person)
        or (p.owner_id = person and p.person_id = auth.uid())
      )
  ) then
    raise exception 'duplicate open plan';
  end if;
  select case when closer_plus then 4 else 3 end into cap
  from public.profiles where id = auth.uid();
  select count(*) into open_count
  from public.plans p
  where p.status = 'upcoming'
    and (p.owner_id = auth.uid() or p.person_id = auth.uid());
  if open_count >= cap then
    raise exception 'open plan limit';
  end if;
  insert into public.plans (owner_id, person_id, venue_id, slot, kind)
  values (auth.uid(), person, venue, slot, kind)
  returning id into plan_id;
  insert into public.deposits (plan_id) values (plan_id);
  return plan_id;
end;
$$;

-- Service role only. The Razorpay webhook is a later edge function and calls this.
create or replace function public.mark_deposit_paid(p_plan uuid, p_payment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  current_payment text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only';
  end if;
  if p_payment is null or length(trim(p_payment)) = 0 then
    raise exception 'payment required';
  end if;
  select status, payment_id into current_status, current_payment
  from public.deposits where plan_id = p_plan for update;
  if not found then
    raise exception 'missing deposit';
  end if;
  if current_status = 'paid' and current_payment = p_payment then
    return;
  end if;
  if current_status = 'paid' then
    raise exception 'already paid';
  end if;
  if exists (
    select 1 from public.deposits d
    where d.payment_id = p_payment and d.plan_id <> p_plan
  ) then
    raise exception 'payment already used';
  end if;
  update public.deposits
    set status = 'paid', payment_id = p_payment
    where plan_id = p_plan;
end;
$$;

create or replace function public.keep_chat(plan uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  person uuid;
begin
  perform public.assert_active();
  select p.owner_id, p.person_id into owner, person
  from public.plans p where p.id = plan;
  if not found then
    raise exception 'missing plan';
  end if;
  if owner = auth.uid() then
    update public.plans set kept_by_owner = true where id = plan;
  elsif person = auth.uid() then
    update public.plans set kept_by_person = true where id = plan;
  else
    raise exception 'not in plan';
  end if;
end;
$$;

create or replace function public.send_message(plan uuid, body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.plans;
  dep_status text;
  message_id uuid;
  open_chat boolean;
begin
  perform public.assert_active();
  if body is null or length(trim(body)) = 0 then
    raise exception 'empty message';
  end if;
  select * into p from public.plans where id = plan;
  if not found then
    raise exception 'missing plan';
  end if;
  if p.owner_id is distinct from uid and p.person_id is distinct from uid then
    raise exception 'not in plan';
  end if;
  if p.status = 'closed' then
    raise exception 'chat closed';
  end if;
  select d.status into dep_status from public.deposits d where d.plan_id = plan;
  open_chat := dep_status = 'paid' and (
    (p.kept_by_owner and p.kept_by_person)
    or (p.booked_at is not null and now() < p.booked_at + interval '48 hours')
  );
  if not open_chat then
    raise exception 'chat closed';
  end if;
  insert into public.messages (plan_id, sender_id, body)
  values (plan, uid, body)
  returning id into message_id;
  return message_id;
end;
$$;

create or replace function public.record_activity(kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('Asia/Kolkata', now()))::date;
  month text := to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM');
  row public.streaks;
  away boolean;
begin
  perform public.assert_active();
  if kind not in ('drop', 'room', 'play', 'freeze') then
    raise exception 'bad activity';
  end if;

  insert into public.streaks (user_id, count, freezes_left, freeze_month)
  values (uid, 0, 2, month)
  on conflict (user_id) do nothing;

  select * into row from public.streaks where user_id = uid for update;

  if row.freeze_month is distinct from month then
    row.freezes_left := 2;
    row.freeze_month := month;
  end if;

  if kind = 'freeze' then
    if row.freezes_left <= 0 or row.last_date is null or (today - row.last_date) <> 2 then
      raise exception 'no freeze';
    end if;
    update public.streaks
      set freezes_left = row.freezes_left - 1,
          freeze_month = row.freeze_month,
          last_date = today - 1
      where user_id = uid;
    return row.count;
  end if;

  select coalesce(p.paused, false)
      or exists (select 1 from public.away_status a where a.user_id = uid)
    into away
  from public.profiles p
  where p.id = uid;

  if away or row.frozen_by_away then
    update public.streaks
      set freezes_left = row.freezes_left,
          freeze_month = row.freeze_month,
          frozen_by_away = true
      where user_id = uid;
    return row.count;
  end if;

  if row.last_date = today then
    update public.streaks
      set freezes_left = row.freezes_left,
          freeze_month = row.freeze_month,
          frozen_by_away = false
      where user_id = uid;
    return row.count;
  end if;

  if row.last_date is null then
    row.count := greatest(1, row.count);
  elsif (today - row.last_date) = 1 then
    row.count := row.count + 1;
  else
    row.count := 1;
  end if;

  update public.streaks
    set count = row.count,
        last_date = today,
        freezes_left = row.freezes_left,
        freeze_month = row.freeze_month,
        frozen_by_away = false
    where user_id = uid;
  return row.count;
end;
$$;

create or replace function public.record_drop_open()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.record_activity('drop');
end;
$$;

create or replace function public.claim_gift(milestone int, gift text, address text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  streak_count int;
  claim_id uuid;
begin
  perform public.assert_active();
  if not exists (
    select 1 from public.profiles p where p.id = uid and p.closer_plus
  ) then
    raise exception 'closer plus only';
  end if;
  if milestone not in (7, 30, 90, 180, 365) then
    raise exception 'bad milestone';
  end if;
  if address is null or length(trim(address)) = 0 then
    raise exception 'address required';
  end if;
  select s.count into streak_count from public.streaks s where s.user_id = uid;
  if coalesce(streak_count, 0) < milestone then
    raise exception 'streak too low';
  end if;
  if exists (
    select 1 from public.gift_claims g
    where g.user_id = uid and g.milestone = claim_gift.milestone
  ) then
    raise exception 'already claimed';
  end if;
  insert into public.gift_claims (user_id, milestone, gift, address)
  values (uid, milestone, gift, trim(address))
  returning id into claim_id;
  return claim_id;
end;
$$;

create or replace function public.confirm_report(report_id uuid, action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reports;
  minor_count int;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not public.is_staff('safety') then
    raise exception 'safety only';
  end if;
  if public.is_banned(auth.uid()) then
    raise exception 'banned';
  end if;
  select * into r from public.reports where id = report_id for update;
  if not found then
    raise exception 'missing report';
  end if;
  if r.against_id is null then
    raise exception 'missing subject';
  end if;
  if action = 'dismiss' then
    update public.reports set status = 'dismissed' where id = report_id;
    insert into public.audit_log (actor, role, action, detail)
    values (auth.uid(), 'safety', 'dismiss report', report_id::text);
    return;
  end if;
  if action <> 'confirm' then
    raise exception 'bad action';
  end if;
  if r.status = 'confirmed' then
    return;
  end if;
  update public.reports set status = 'confirmed' where id = report_id;
  insert into public.strikes (report_id, user_id, category)
  values (r.id, r.against_id, r.category);
  select count(*) into minor_count
  from public.strikes s
  join public.reports rr on rr.id = s.report_id
  where s.user_id = r.against_id and rr.severe = false;
  if r.severe or minor_count >= 3 then
    insert into public.bans (user_id, reason)
    values (r.against_id, case when r.severe then 'severe' else 'third strike' end)
    on conflict (user_id) do nothing;
  end if;
  insert into public.audit_log (actor, role, action, detail)
  values (
    auth.uid(),
    'safety',
    'confirm report',
    r.against_id::text || ' ' || r.category
  );
end;
$$;

create or replace function public.confirm_trusted_contact(token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated int;
begin
  if uid is null then
    raise exception 'auth required';
  end if;
  if token is null or length(trim(token)) = 0 then
    raise exception 'bad token';
  end if;
  perform set_config('closer.trusted_confirm', 'yes', true);
  update public.trusted_contacts
    set confirmed = true
    where confirm_token = token and user_id = uid and confirmed = false;
  get diagnostics updated = row_count;
  if updated <> 1 then
    raise exception 'bad token';
  end if;
end;
$$;

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'auth required';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private storage (fix 18). Signed reads use the service role, which bypasses
-- these policies. There is no public read.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('photos', 'photos', false),
  ('voice', 'voice', false),
  ('selfies', 'selfies', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists objects_owner_read on storage.objects;
create policy objects_owner_read on storage.objects
  for select using (
    bucket_id in ('photos', 'voice', 'selfies')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists objects_owner_insert on storage.objects;
create policy objects_owner_insert on storage.objects
  for insert with check (
    bucket_id in ('photos', 'voice', 'selfies')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists objects_owner_update on storage.objects;
create policy objects_owner_update on storage.objects
  for update
  using (auth.uid()::text = (storage.foldername(name))[1])
  with check (
    bucket_id in ('photos', 'voice', 'selfies')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists objects_owner_delete on storage.objects;
create policy objects_owner_delete on storage.objects
  for delete using (
    bucket_id in ('photos', 'voice', 'selfies')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Privileges. Authenticated writes go through the functions above.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;

revoke insert, update, delete on all tables in schema public from anon;
revoke insert, update, delete on storage.objects from anon;

revoke insert, update, delete on public.deposits from authenticated;
revoke insert, update, delete on public.likes from authenticated;
revoke insert, update, delete on public.messages from authenticated;
revoke insert, update, delete on public.matches from authenticated;
revoke insert, update, delete on public.drops from authenticated;
revoke insert, update, delete on public.drop_picks from authenticated;
revoke insert, update, delete on public.streaks from authenticated;
revoke insert, update, delete on public.strikes from authenticated;
revoke insert, update, delete on public.bans from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.gift_claims from authenticated;
revoke insert, update, delete on public.social_connections from authenticated;
revoke insert, update, delete on public.plans from authenticated;
revoke update, delete on public.reports from authenticated;

revoke all on all functions in schema public from public;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.is_banned(uuid) to anon;
grant execute on function public.my_phone_hash() to anon;
grant execute on function public.viewer_is_verified() to anon;
grant execute on function public.hidden_by_contacts(uuid) to anon;
grant execute on function public.profile_is_visible(uuid) to anon;
grant execute on function public.is_staff(text) to anon;
grant execute on function public.dob_is_adult(date) to anon, authenticated, service_role;

revoke execute on function public.mark_deposit_paid(uuid, text) from authenticated;
revoke execute on function public.send_like(uuid, text) from anon;
revoke execute on function public.create_plan(uuid, text, text, text) from anon;
revoke execute on function public.record_activity(text) from anon;
revoke execute on function public.record_drop_open() from anon;
revoke execute on function public.claim_gift(integer, text, text) from anon;
revoke execute on function public.confirm_report(uuid, text) from anon;
revoke execute on function public.keep_chat(uuid) from anon;
revoke execute on function public.send_message(uuid, text) from anon;
revoke execute on function public.delete_account() from anon;
revoke execute on function public.confirm_trusted_contact(text) from anon;
revoke execute on function public.mark_deposit_paid(uuid, text) from anon;
