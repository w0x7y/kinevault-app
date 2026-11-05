import type { Href } from "expo-router";
import { Children, isValidElement, type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import Animated from "react-native-reanimated";
import { Icon, type IconName } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { useStateTransition } from "../components/motion";
import { Tappable } from "../components/tappable";
import { AppText, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, spacing } from "../theme/tokens";

/** IconWell's regular width, which inset dividers clear. */
const well = 38;
const rowPadding = 16;

/** A grouped settings section: an overline title above one card of rows. */
export function SettingsGroup({
  title,
  testID,
  cardTestID,
  fullDividers,
  children,
  after,
}: {
  title: string;
  testID?: string;
  cardTestID?: string;
  fullDividers?: boolean;
  children: ReactNode;
  /** Content outside the card, such as a separate destructive card. */
  after?: ReactNode;
}) {
  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <AppText
        variant="overline"
        muted
        accessibilityRole="header"
        style={{ paddingHorizontal: spacing.xs + 2 }}
      >
        {title}
      </AppText>
      <SettingsCard testID={cardTestID} fullDividers={fullDividers}>
        {children}
      </SettingsCard>
      {after}
    </View>
  );
}

/** A card of rows separated by hairlines, inset past the icon wells unless `fullDividers`.
 * Falsy children are skipped. */
export function SettingsCard({
  children,
  style,
  fullDividers = false,
  ...props
}: ViewProps & { fullDividers?: boolean }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Panel {...props} style={[{ padding: 0, gap: 0, overflow: "hidden" }, style]}>
      {rows.map((row, index) => (
        <View key={row.key ?? index}>
          {index > 0 && <RowDivider inset={!fullDividers} />}
          {row}
        </View>
      ))}
    </Panel>
  );
}

export function RowDivider({ inset = true }: { inset?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: inset ? rowPadding + well + spacing.md : 0,
        backgroundColor: colors.border,
      }}
    />
  );
}

/** Padding for free-form content that sits in a settings card between rows. */
export function RowContent({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ padding: rowPadding, gap: spacing.md }, style]} />;
}

type RowProps = {
  icon?: IconName;
  title: string;
  description?: string;
  /** Muted value shown before the chevron. */
  value?: string;
  disabled?: boolean;
  trailing?: ReactNode;
};

/** A row that navigates. Its accessible name is its visible text. */
export function SettingsLinkRow({ href, ...row }: RowProps & { href: Href }) {
  return (
    <Tappable
      role="link"
      href={href}
      label={[row.title, row.description, row.value].filter(Boolean).join(" ")}
      disabled={row.disabled}
      feedback="fill"
      style={rowStyle}
    >
      <RowBody {...row} chevron />
    </Tappable>
  );
}

/** A row that acts. Only the title names it, so descriptions stay supporting text. */
export function SettingsButtonRow({
  onPress,
  chevron = false,
  ...row
}: RowProps & { onPress: () => void; chevron?: boolean }) {
  return (
    <Tappable
      label={row.title}
      disabled={row.disabled}
      onPress={onPress}
      feedback="fill"
      style={rowStyle}
    >
      <RowBody {...row} chevron={chevron} />
    </Tappable>
  );
}

/** A row that turns a setting on or off. Only the title names it, like a button row. */
export function SettingsSwitchRow({
  value,
  onChange,
  ...row
}: Omit<RowProps, "trailing" | "value"> & { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Tappable
      role="switch"
      label={row.title}
      checked={value}
      disabled={row.disabled}
      onPress={() => onChange(!value)}
      feedback="fill"
      style={rowStyle}
    >
      <RowBody {...row} trailing={<SwitchTrack value={value} />} chevron={false} />
    </Tappable>
  );
}

/** The switch's track and thumb. The thumb slides and the track tints, like the platform switch. */
export function SwitchTrack({ value }: { value: boolean }) {
  const { colors, appearance } = useTheme();
  const trackTransition = useStateTransition(["backgroundColor"]);
  const thumbTransition = useStateTransition(["transform", "backgroundColor"]);
  return (
    <Animated.View
      style={[
        {
          width: 48,
          height: 28,
          padding: 3,
          borderRadius: 14,
          justifyContent: "center",
          alignItems: "flex-start",
          backgroundColor: value ? colors.primary : colors.input,
        },
        trackTransition,
      ]}
    >
      <Animated.View
        style={[
          {
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: value
              ? colors.primaryForeground
              : appearance === "dark"
                ? colors.mutedForeground
                : colors.card,
            boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.18)",
            // 48 wide, less 3 padding each side and the 22 thumb.
            transform: [{ translateX: value ? 20 : 0 }],
          },
          thumbTransition,
        ]}
      />
    </Animated.View>
  );
}

const rowStyle = {
  minHeight: 60,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.md,
  paddingHorizontal: rowPadding - 2,
  paddingVertical: spacing.md - 4,
} as const;

function RowBody({
  icon,
  title,
  description,
  value,
  trailing,
  chevron,
}: RowProps & { chevron: boolean }) {
  const { colors } = useTheme();
  return (
    <>
      {icon && <IconWell icon={icon} />}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText
          variant="label"
          style={{
            fontSize: 15,
            lineHeight: 21,
            fontFamily: fonts.semibold,
            color: colors.foreground,
          }}
        >
          {title}
        </AppText>
        {description && (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        )}
      </View>
      {value && (
        <AppText variant="label" muted style={{ fontFamily: fonts.medium }}>
          {value}
        </AppText>
      )}
      {trailing}
      {chevron && <Icon name="chevron-right" size={16} color={colors.mutedForeground} />}
    </>
  );
}
