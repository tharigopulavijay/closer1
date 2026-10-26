export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL ?? "",
};

export const backendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
