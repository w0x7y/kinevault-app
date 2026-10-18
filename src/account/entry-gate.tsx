import { Redirect } from "expo-router";
import { KineLoading } from "../components/kine-loading";
import { ProfileRecovery } from "../profile/recovery";
import type { EntryDecision } from "./entry-policy";

/** Renders an entry decision that replaces the route. Storage failure has its own screen. */
export function EntryGate({ decision }: { decision: EntryDecision }) {
  switch (decision.kind) {
    case "loading":
      return <KineLoading fill />;
    case "redirect":
      return <Redirect href={decision.href} />;
    case "profileRecovery":
      return <ProfileRecovery />;
    default:
      return null;
  }
}
