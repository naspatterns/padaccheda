/** Public runtime config for anonymous correction collection.
 *
 * These values are PUBLIC by design and safe to commit to a public repo:
 * the Supabase anon key only permits INSERT into `corrections` (row-level
 * security), never reads or edits. Leaving SUPABASE_URL empty disables all
 * network submission — the app then behaves exactly as before (localStorage
 * + manual Export only).
 *
 * To enable collection, paste the project's URL and anon public key below
 * (Supabase → Project Settings → API).
 */
export const SUPABASE_URL = '';        // e.g. 'https://xxxxxxxx.supabase.co'
export const SUPABASE_ANON_KEY = '';   // anon public key (safe to expose)

/** Collection defaults to ON after the one-time notice (opt-out model). */
export const COLLECT_ENABLED_DEFAULT = true;
