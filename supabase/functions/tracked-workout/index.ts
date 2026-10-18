import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createTrackedWorkoutHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_ANON_KEY");
if (!url || !key) throw new Error("Tracked workout service is not configured");
// The public key is enough: the function only checks the caller and reads public pages.
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

Deno.serve(
  createTrackedWorkoutHandler({
    async authenticate(token) {
      const { data, error } = await client.auth.getUser(token);
      return error || !data.user
        ? null
        : { id: data.user.id, anonymous: data.user.is_anonymous ?? false };
    },
    fetch: (input, init) => fetch(input, init),
  }),
);
