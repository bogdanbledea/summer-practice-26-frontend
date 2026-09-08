import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { HttpError } from "./errors.js";

// Service role: bypasses RLS, must never leave the server.
export const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SupabaseError = { message: string; code?: string } | null;

/** PostgREST reports failures in the payload rather than by throwing. */
export function orThrow<T>(result: {
  data: T | null;
  error: SupabaseError;
}): T {
  if (result.error) {
    console.error(result.error);
    throw new HttpError(500, "The database rejected that request.");
  }
  if (result.data === null) {
    throw new HttpError(500, "The database returned nothing.");
  }
  return result.data;
}
