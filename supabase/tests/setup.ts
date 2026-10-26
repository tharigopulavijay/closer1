import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * PGlite stand-in for `supabase start`.
 * Supabase's storage catalog and pg_cron are not part of Postgres.
 * 0002_rules.sql does not schedule pg_cron. Storage is stubbed below so the
 * bucket insert and owner policies in that migration can run. On hosted
 * Supabase the real storage schema is already there and this stub is not used.
 */
const bootstrap = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key
);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin nosuperuser nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin nosuperuser nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin nosuperuser bypassrls;
  end if;
end
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'role', '');
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

const storageStub = `
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;
`;

function migration(name: string) {
  return readFileSync(join(root, "migrations", name), "utf8").replace(
    /create extension if not exists pgcrypto\s*;/gi,
    "",
  );
}

export async function createTestDb() {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(bootstrap);
  await db.query(`select gen_random_uuid()`);
  await db.query(`select timezone('Asia/Kolkata', now())`);
  await db.exec(migration("0001_init.sql"));
  await db.exec(storageStub);
  await db.exec(migration("0002_rules.sql"));
  await db.exec(migration("0003_hardening.sql"));
  return db;
}

function claims(id: string | null, role: string, roles: string[]) {
  return JSON.stringify({
    sub: id,
    role,
    app_metadata: { roles },
  });
}

export async function asUser<T>(
  db: PGlite,
  id: string,
  fn: (tx: Transaction) => Promise<T>,
  roles: string[] = [],
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims(id, "authenticated", roles)]);
    return fn(tx);
  });
}

export async function asService<T>(db: PGlite, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role service_role`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims(null, "service_role", [])]);
    return fn(tx);
  });
}
