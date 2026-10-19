/**
 * Reads the public Supabase settings. Only the project URL and the publishable
 * key may live in browser code. No client is created yet: the demo runs on the
 * in-memory repository whether or not these are set.
 */
export interface SupabaseConfig {
  url: string
  publishableKey: string
}

export function readSupabaseConfig(
  env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string } = import.meta.env,
): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  return url && publishableKey ? { url, publishableKey } : null
}
