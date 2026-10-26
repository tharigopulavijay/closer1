-- Review fixes on top of 0002_rules.sql.
-- 1. Moderation before delivery: chat messages are inserted only by the
--    send-message Edge Function (service role) after it has moderated the text.
-- 2. closer_plus is server-owned, like verified.
-- 3. Trusted contacts are confirmed only through the SMS link (service role),
--    and the user can neither read nor choose the confirmation token.

-- ---------------------------------------------------------------------------
-- 1. Messages
-- ---------------------------------------------------------------------------

drop function public.send_message(uuid, text);

create or replace function public.deliver_message(sender uuid, plan uuid, body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.plans;
  dep_status text;
  message_id uuid;
  open_chat boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only';
  end if;
  if sender is null then
    raise exception 'auth required';
  end if;
  if public.is_banned(sender) then
    raise exception 'banned';
  end if;
  if body is null or length(trim(body)) = 0 then
    raise exception 'empty message';
  end if;
  select * into p from public.plans where id = plan;
  if not found then
    raise exception 'missing plan';
  end if;
  if p.owner_id is distinct from sender and p.person_id is distinct from sender then
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
  values (plan, sender, body)
  returning id into message_id;
  return message_id;
end;
$$;

revoke all on function public.deliver_message(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.deliver_message(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. closer_plus
-- ---------------------------------------------------------------------------

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
     or new.closer_plus is distinct from old.closer_plus
     or (old.verified and new.dob is distinct from old.dob)
  then
    raise exception 'protected field';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trusted contacts
-- ---------------------------------------------------------------------------

create or replace function public.protect_trusted_confirmed()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.confirmed then
      raise exception 'confirm via link';
    end if;
    new.confirm_token := null;
  else
    if new.confirmed is distinct from old.confirmed then
      raise exception 'confirm via link';
    end if;
    new.confirm_token := old.confirm_token;
  end if;
  return new;
end;
$$;

revoke select on public.trusted_contacts from anon, authenticated;
grant select (id, user_id, name, phone_hash, confirmed) on public.trusted_contacts to authenticated;

drop function public.confirm_trusted_contact(text);

-- Called by the Edge Function behind the SMS link the contact opens.
create or replace function public.confirm_trusted_contact(token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only';
  end if;
  if token is null or length(trim(token)) = 0 then
    raise exception 'bad token';
  end if;
  update public.trusted_contacts
    set confirmed = true, confirm_token = null
    where confirm_token = token and confirmed = false;
  get diagnostics updated = row_count;
  if updated <> 1 then
    raise exception 'bad token';
  end if;
end;
$$;

revoke all on function public.confirm_trusted_contact(text) from public, anon, authenticated;
grant execute on function public.confirm_trusted_contact(text) to service_role;
