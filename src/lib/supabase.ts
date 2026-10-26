import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

export function getSupabase() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  if (!client) client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
