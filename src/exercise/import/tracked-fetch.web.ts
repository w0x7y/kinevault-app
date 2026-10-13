import { getSupabaseClient } from "../../account/client";
import { WorkoutImportError, type ImportedWorkoutPlan } from "./plan.ts";
import type { TrackedDownloadOptions } from "./tracked-download.ts";
import type { TrackedLink } from "./tracked-link.ts";
import { fetchTrackedWorkoutThroughRelay, trackedRelayUrl } from "./tracked-relay.ts";

// Tracked doesn't allow cross-origin reads, so the browser downloads share pages
// through KineVault's Supabase function. It needs the account configuration.
const url = trackedRelayUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const apiKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
export const linkImportAvailable = Boolean(url && apiKey);

export async function fetchTrackedWorkout(
  link: TrackedLink,
  options: TrackedDownloadOptions = {},
): Promise<ImportedWorkoutPlan> {
  if (!url || !apiKey)
    throw new WorkoutImportError(
      "unsupported",
      "Importing from a link works in the KineVault iOS and Android app.",
    );
  return fetchTrackedWorkoutThroughRelay(
    link,
    {
      url,
      apiKey,
      async accessToken() {
        const client = getSupabaseClient();
        if (!client) return null;
        const { data, error } = await client.auth.getSession();
        return error ? null : (data.session?.access_token ?? null);
      },
    },
    options,
  );
}
