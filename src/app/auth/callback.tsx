import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useAccount } from "../../account/provider";
import { sanitizedAuthPath } from "../../account/auth-links";
import { AppText } from "../../components/ui";
import { Button } from "../../onboarding/controls";
import { useTheme } from "../../theme/provider";
import { spacing } from "../../theme/tokens";

export default function AuthCallbackScreen() {
  const account = useAccount();
  const { colors } = useTheme();
  const parameters = useLocalSearchParams();
  const incoming = Linking.useLinkingURL();
  const original = useRef<string | null>(null);
  const started = useRef(false);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);
  const showFailure = failed && (Platform.OS !== "web" || !Object.values(parameters).some(value => value !== undefined));
  if (!original.current) {
    // Linking's web hook can retain the previous route's launch URL. Capture the
    // browser URL at this mount before sanitizing it; native launch URLs must
    // point to an auth callback rather than another screen.
    if (Platform.OS === "web" && typeof window !== "undefined") original.current = window.location.href;
    else if (incoming && sanitizedAuthPath(incoming)) original.current = incoming;
  }

  useEffect(() => {
    if (account.loading || started.current) return;
    started.current = true;
    const url = original.current ?? (Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : Linking.createURL("auth/callback"));
    original.current = url;
    // Start in the stable provider before URL cleanup can remount this screen.
    const verification = account.resumeAuthLink(url) ?? account.completeAuthLink(url);
    // Keep the link only in memory while processing, never in browser history.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const path = sanitizedAuthPath(url);
      if (path) {
        // Replacing the route clears Expo Router's captured initial query too.
        // setParams alone can replay that initial query when a stack remounts.
        const parsed = new URL(url);
        if (parsed.search || parsed.hash) router.replace(path as Href);
        window.history.replaceState(window.history.state, "", path);
      }
    } else Linking.clearInitialURL();
    let active = true;
    void verification.then(success => {
      if (!active) return;
      if (success) setVerified(true); else setFailed(true);
    });
    return () => { active = false; started.current = false; };
  }, [account.loading, account.completeAuthLink, account.resumeAuthLink]);

  useEffect(() => {
    if (verified) {
      account.acknowledgeAuthLink();
      router.replace((account.recovery ? "/auth/reset-password" : "/account") as Href);
    }
  }, [verified, account.recovery, account.acknowledgeAuthLink]);

  async function retry() {
    if (!original.current || account.busy) return;
    setFailed(false);
    const success = await (account.resumeAuthLink(original.current) ?? account.completeAuthLink(original.current));
    if (success) setVerified(true); else setFailed(true);
  }

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.layout, gap: spacing.layout, alignSelf: "center", width: "100%", maxWidth: 560 }}>
      <AppText variant="title" accessibilityRole="header">{showFailure ? "Check your email link" : "Verifying your account"}</AppText>
      <AppText muted accessibilityLiveRegion="polite">{showFailure ? "Request a fresh link if this one has expired. Open it on the device where you requested it." : "Please wait while we verify the link from your email."}</AppText>
      {showFailure && <>
        <AppText accessibilityRole="alert" style={{ color: colors.error }}>{account.error ?? "This link is incomplete. Request a new one and try again."}</AppText>
        <Button label={account.busy ? "Verifying…" : "Try again"} disabled={account.busy || account.loading} onPress={() => void retry()} />
        <Button label="Back to account" secondary disabled={account.busy} onPress={() => { account.acknowledgeAuthLink(); router.replace("/account" as Href); }} />
      </>}
    </ScrollView>
  </SafeAreaView>;
}
