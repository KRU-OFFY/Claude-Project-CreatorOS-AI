import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Service-role client — bypasses RLS. NEVER import this from a client component.
// The `server-only` import above makes the bundler throw if it leaks to the client.
// Used for token operations (channel_connections) and system-level writes.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!env.supabaseUrl || !serviceKey) return null;
  return createClient(env.supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
