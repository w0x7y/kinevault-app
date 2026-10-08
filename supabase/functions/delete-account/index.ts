import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createDeleteAccountHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_ANON_KEY");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key || !serviceKey) throw new Error("Account deletion service is not configured");
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
// This privileged client lives only in the Edge Function environment.
const admin = createClient(url, serviceKey, options);

Deno.serve(
  createDeleteAccountHandler({
    async authenticate(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
    },
    async reauthenticate(email, password) {
      // Use a per-request client: one request's password session must never
      // replace the credentials of another request or the admin client.
      const verifier = createClient(url, key, options);
      const { data, error } = await verifier.auth.signInWithPassword({ email, password });
      return error || !data.session
        ? null
        : { id: data.session.user.id, accessToken: data.session.access_token };
    },
    async revokeSessions(token) {
      const { error } = await admin.auth.admin.signOut(token, "global");
      if (error) throw error;
    },
    async deleteUser(id) {
      // Hard deletion cascades the reviewed shared account + Track FK rows.
      const { error } = await admin.auth.admin.deleteUser(id, false);
      if (error) throw error;
    },
  }),
);
