import { Image } from "expo-image";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import type { Membership } from "../account/membership";
import { AppButton } from "../components/button";
import { Icon } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { InlineMessage } from "../components/inline-message";
import { SheetPage, useSheetControls } from "../components/sheet-page";
import { Tappable } from "../components/tappable";
import { AppText, Overline, Panel } from "../components/ui";
import { addDays, dayKey, parseDay } from "../calendar/dates";
import { kineAssets } from "../onboarding/kine-assets";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import {
  paywallRows,
  paywallSource,
  plusCheckout,
  plusPlanCards,
  plusPrices,
  plusStore,
  type PaywallRow,
  type PaywallSource,
  type PlusPlan,
  type PlusStore,
} from "./plans";
import { usePlus } from "./provider";
import { plusPurchases, purchaseMessage, type PurchaseResult } from "./purchases";

/**
 * The paywall, opened from where it's needed: `open` it with the feature that asked, and render
 * `sheet` in the caller's tree, so on a phone it stacks over whichever sheet the caller is on.
 */
export function usePaywall() {
  const [source, setSource] = useState<PaywallSource | null>(null);
  return {
    open: (from: PaywallSource) => setSource(from),
    sheet: source && <PaywallSheet source={source} onClose={() => setSource(null)} />,
  };
}

function PaywallSheet({ source, onClose }: { source: PaywallSource; onClose: () => void }) {
  const plus = usePlus();
  const store = plusStore(Platform.OS);
  const [plan, setPlan] = useState<PlusPlan>("yearly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState<Membership | null>(null);
  async function run(action: () => Promise<PurchaseResult>) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (result.kind === "purchased") {
        plus.purchased(result.membership);
        setJoined(result.membership);
      } else setMessage(purchaseMessage(result));
    } catch {
      setMessage(purchaseMessage({ kind: "failed" }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SheetPage
      stacked
      title="KineVault Plus"
      // The hero names the page; the header keeps only its close button.
      center={<View />}
      closeLabel="Close KineVault Plus"
      closeDisabled={busy}
      onClose={onClose}
      page={joined ? "welcome" : "offer"}
      testID="plus-paywall"
    >
      {joined ? (
        <Welcome source={source} store={store} membership={joined} onDone={onClose} />
      ) : (
        <Offer
          source={source}
          store={store}
          plan={plan}
          onPlan={setPlan}
          busy={busy}
          message={message}
          onBuy={() => void run(() => plusPurchases.buy(plan))}
          onRestore={() => void run(plusPurchases.restore)}
          onPrivacy={() => {
            onClose();
            router.push("/privacy");
          }}
        />
      )}
    </SheetPage>
  );
}

function KineDisc({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.brandSoft,
      }}
    >
      <Image
        source={kineAssets.review}
        contentFit="contain"
        transition={0}
        accessible={false}
        style={{ width: size * 0.84, height: size * 0.84 }}
      />
    </View>
  );
}

function Offer({
  source,
  store,
  plan,
  onPlan,
  busy,
  message,
  onBuy,
  onRestore,
  onPrivacy,
}: {
  source: PaywallSource;
  store: PlusStore;
  plan: PlusPlan;
  onPlan: (plan: PlusPlan) => void;
  busy: boolean;
  message: string | null;
  onBuy: () => void;
  onRestore: () => void;
  onPrivacy: () => void;
}) {
  const { colors } = useTheme();
  const { context } = paywallSource(source, store);
  const checkout = plusCheckout(plan, store);
  useSheetControls({
    footer: (
      <View style={{ gap: spacing.sm + 2 }}>
        <AppButton
          tone="primary"
          label={busy ? "Please wait…" : checkout.action}
          busy={busy}
          onPress={onBuy}
        />
        <InlineMessage tone="info" align="center">
          {message}
        </InlineMessage>
        <AppText
          variant="caption"
          muted
          style={{ fontSize: 12, lineHeight: 17, textAlign: "center" }}
        >
          {checkout.terms}
        </AppText>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: spacing.md,
            marginTop: -spacing.xs,
          }}
        >
          <AppButton tone="link" label="Restore purchases" disabled={busy} onPress={onRestore} />
          <AppButton
            tone="link"
            label="Terms"
            accessibilityLabel={`Terms of use, opens ${store.name} terms`}
            onPress={() => void Linking.openURL(store.termsUrl).catch(() => {})}
          />
          <AppButton
            tone="link"
            label="Privacy"
            accessibilityLabel="Privacy policy"
            disabled={busy}
            onPress={onPrivacy}
          />
        </View>
      </View>
    ),
  });
  return (
    <View style={{ gap: spacing.layout }}>
      <View style={{ alignItems: "center", gap: spacing.sm + 2, paddingBottom: spacing.xs }}>
        <KineDisc size={96} />
        <Overline style={{ marginTop: spacing.xs }}>KineVault Plus</Overline>
        <AppText
          variant="display"
          accessibilityRole="header"
          style={{ fontSize: 28, lineHeight: 36, textAlign: "center" }}
        >
          See where your training is going
        </AppText>
        <AppText muted style={{ fontSize: 15, lineHeight: 22, textAlign: "center" }}>
          Free covers every log. Plus adds long-range trends, training tools and every exercise
          demo.
        </AppText>
      </View>
      {context && (
        <View
          testID="plus-paywall-context"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm + 2,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md + 2,
            borderRadius: radius.control,
            backgroundColor: colors.brandSoft,
          }}
        >
          <Icon name="wand-magic-sparkles" size={18} color={colors.brand} />
          <AppText variant="label" style={{ flex: 1 }}>
            {context}
          </AppText>
        </View>
      )}
      <Panel style={{ paddingVertical: spacing.xs, gap: 0 }}>
        {paywallRows(store).map((row, index) => (
          <FeatureRow key={row.key} row={row} first={index === 0} />
        ))}
      </Panel>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Plus plan"
        style={{ gap: spacing.sm + 2, marginTop: spacing.xs }}
      >
        {plusPlanCards().map((card) => {
          const chosen = card.plan === plan;
          return (
            <Tappable
              key={card.plan}
              role="radio"
              checked={chosen}
              label={[card.name, card.badge, card.caption, card.price, card.per]
                .filter(Boolean)
                .join(", ")}
              disabled={busy}
              onPress={() => onPlan(card.plan)}
              ring="outline"
              style={{
                minHeight: 72,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md + 2,
                paddingVertical: spacing.md - (chosen ? 1 : 0),
                paddingHorizontal: spacing.lg - 2 - (chosen ? 1 : 0),
                borderRadius: radius.control + 2,
                borderWidth: chosen ? 2 : 1,
                borderColor: chosen ? colors.primary : colors.border,
                backgroundColor: colors.card,
              }}
            >
              {card.badge && (
                <View
                  style={{
                    position: "absolute",
                    top: -10,
                    right: spacing.layout,
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 2,
                    borderRadius: radius.pill,
                    backgroundColor: colors.success,
                  }}
                >
                  <AppText
                    style={{
                      fontFamily: fonts.extrabold,
                      fontSize: 11,
                      lineHeight: 16,
                      color: colors.card,
                    }}
                  >
                    {card.badge}
                  </AppText>
                </View>
              )}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: chosen ? colors.primary : colors.input,
                  backgroundColor: chosen ? colors.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {chosen && <Icon name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <AppText
                  variant="label"
                  style={{ fontSize: 16, lineHeight: 22, fontFamily: fonts.bold }}
                >
                  {card.name}
                </AppText>
                <AppText variant="caption" muted>
                  {card.caption}
                </AppText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <AppText style={{ fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 22 }}>
                  {card.price}
                </AppText>
                <AppText variant="caption" muted>
                  {card.per}
                </AppText>
              </View>
            </Tappable>
          );
        })}
      </View>
      <AppText variant="caption" muted style={{ textAlign: "center", marginTop: spacing.xs }}>
        Your logs, sync, export and account deletion stay free.
      </AppText>
    </View>
  );
}

function FeatureRow({
  row,
  first,
  trailing,
  caption = row.caption,
}: {
  row: PaywallRow;
  first: boolean;
  trailing?: ReactNode;
  caption?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: trailing ? "center" : "flex-start",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <IconWell icon={row.icon} color={colors.brand} background="brandSoft" />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" style={{ fontSize: 15, lineHeight: 21, fontFamily: fonts.bold }}>
          {row.title}
        </AppText>
        <AppText variant="caption" muted>
          {caption}
        </AppText>
      </View>
      {trailing}
    </View>
  );
}

/** The paywall's last step: what's unlocked and the way back to where it opened. */
function Welcome({
  source,
  store,
  membership,
  onDone,
}: {
  source: PaywallSource;
  store: PlusStore;
  membership: Membership;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const { welcome, back } = paywallSource(source, store);
  useSheetControls({ footer: <AppButton tone="primary" label={back} onPress={onDone} /> });
  const trialEnd = parseDay(addDays(dayKey(new Date()), plusPrices.trialDays)).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );
  return (
    <View
      testID="plus-welcome"
      style={{ flexGrow: 1, justifyContent: "center", gap: spacing.layout }}
    >
      <KineDisc size={132} />
      <AppText variant="display" accessibilityRole="header" style={{ textAlign: "center" }}>
        Welcome to Plus
      </AppText>
      <AppText muted style={{ textAlign: "center", marginHorizontal: spacing.sm }}>
        {membership.status === "trialing"
          ? `Your free trial runs until ${trialEnd}. Cancel anytime in ${store.name} settings.`
          : `Plus is on. Manage it anytime in ${store.name} settings.`}
      </AppText>
      <Panel style={{ paddingVertical: spacing.xs, gap: 0, marginTop: spacing.sm }}>
        {welcome.map((row, index) => (
          <FeatureRow
            key={row.key}
            row={row}
            first={index === 0}
            caption={row.ready}
            trailing={
              <View
                style={{
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                  backgroundColor: colors.muted,
                }}
              >
                <AppText
                  variant="caption"
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 12,
                    lineHeight: 16,
                    color: colors.success,
                  }}
                >
                  Unlocked
                </AppText>
              </View>
            }
          />
        ))}
      </Panel>
    </View>
  );
}
