import { createBrowserClient } from '@supabase/ssr';

// Use || (not ??) so empty-string env vars also fall back to placeholder.
// This prevents build crashes when Supabase secrets are not yet configured.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
);
