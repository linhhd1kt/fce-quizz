import { createBrowserClient } from '@supabase/ssr';

// Fallback placeholders prevent build-time crash when env vars are not yet configured.
// Runtime calls will fail gracefully until NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY are added to the environment.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
);
