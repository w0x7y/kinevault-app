import type { WorkoutImportFlowSource } from "./import-flow.ts";
import { WorkoutImportError } from "./plan.ts";
import { fetchTrackedWorkout, linkImportAvailable } from "./tracked-fetch";
import { readTrackedLink } from "./tracked-link.ts";

export type WorkoutImportSource = WorkoutImportFlowSource & {
  label: string;
  summary: string;
  help: string;
  inputLabel: string;
  placeholder: string;
  /** Null when this platform can import from the source. */
  unavailable: string | null;
};

// Each source turns what the user pastes into a platform-neutral workout plan.
export const workoutImportSources: readonly WorkoutImportSource[] = [
  {
    id: "tracked",
    label: "Tracked",
    summary: "Paste a workout share link.",
    help: "In Tracked, open the workout, tap Share, then Copy link. Paste the link here.",
    inputLabel: "Tracked workout link",
    placeholder: "https://app.tracked.gg/v/workout/…",
    unavailable: linkImportAvailable
      ? null
      : "Importing from a link works in the KineVault iOS and Android app.",
    async load(text, signal) {
      const link = readTrackedLink(text);
      if (!link)
        throw new WorkoutImportError(
          "invalid-link",
          "Paste a Tracked workout link. It starts with https://app.tracked.gg/v/workout/.",
        );
      return fetchTrackedWorkout(link, { signal });
    },
  },
];
