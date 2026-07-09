// Central, crash-safe access to environment configuration.
// The app must boot and render a setup notice even when env vars are missing.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "claude-sonnet-5",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isAiConfigured(): boolean {
  return Boolean(env.anthropicApiKey);
}
