import { createClient } from "@supabase/supabase-js";

// Only Chitkara students can sign up. The frontend uses this for instant
// feedback; the real boundary is the enforce_chitkara_domain trigger on
// auth.users (see CLAUDE.md).
export const ALLOWED_DOMAIN = "chitkara.edu.in";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Add them to .env and restart the dev server."
  );
}

export const supabase = createClient(url, anonKey);

// TESTING: set back to true before real students use this, so only
// @chitkara.edu.in emails are accepted. false = allow any email.
const RESTRICT_TO_CHITKARA = true;

export function isAllowedEmail(email) {
  if (typeof email !== "string") return false;
  if (!RESTRICT_TO_CHITKARA) return /\S+@\S+\.\S+/.test(email.trim());
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}
