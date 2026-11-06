import { useState } from "react";
import { Linking, Platform } from "react-native";
import {
  RowContent,
  SettingsButtonRow,
  SettingsGroup,
  SettingsInfoRow,
} from "../account/settings-list";
import { InlineMessage } from "../components/inline-message";
import { usePaywall } from "./paywall";
import { plusPrices, plusStore } from "./plans";
import { usePlus } from "./provider";
import { plusPurchases, purchaseMessage } from "./purchases";

/** Settings → Membership, after the account card. Free offers Plus; Plus hands billing to the store. */
export function MembershipSettings() {
  const plus = usePlus();
  const paywall = usePaywall();
  const store = plusStore(Platform.OS);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!plus.offered) return null;
  async function restore() {
    setRestoring(true);
    setMessage(null);
    try {
      const result = await plusPurchases.restore();
      if (result.kind === "purchased") plus.purchased(result.membership);
      else setMessage(purchaseMessage(result));
    } catch {
      setMessage(purchaseMessage({ kind: "failed" }));
    } finally {
      setRestoring(false);
    }
  }
  const member = plus.unlocked ? plus.known : null;
  return (
    <SettingsGroup title="Membership" cardTestID="membership-settings" after={paywall.sheet}>
      {member ? (
        <SettingsInfoRow
          icon="wand-magic-sparkles"
          title={member.plan === "pro" ? "KineVault Pro" : "KineVault Plus"}
          description={
            member.status === "trialing"
              ? `Free trial. Then renews through the ${store.name}.`
              : member.status === "past_due"
                ? `Payment due. Update it in ${store.name} settings to keep Plus.`
                : `Renews automatically through the ${store.name}.`
          }
        />
      ) : (
        <SettingsButtonRow
          icon="wand-magic-sparkles"
          title="Get KineVault Plus"
          description={`Long-range trends, detailed nutrients and every demo. ${plusPrices.trialDays} days free.`}
          chevron
          onPress={() => paywall.open("settings")}
        />
      )}
      {member ? (
        <SettingsButtonRow
          icon="credit-card"
          title="Manage subscription"
          description={`Opens ${store.name} subscriptions`}
          chevron
          onPress={() => void Linking.openURL(store.subscriptionsUrl).catch(() => {})}
        />
      ) : (
        <SettingsButtonRow
          icon="rotate-left"
          title={restoring ? "Restoring purchases…" : "Restore purchases"}
          disabled={restoring}
          onPress={() => void restore()}
        />
      )}
      {message && (
        <RowContent>
          <InlineMessage tone="info">{message}</InlineMessage>
        </RowContent>
      )}
    </SettingsGroup>
  );
}
