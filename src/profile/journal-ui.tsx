import { useCallback, useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import {
  Platform,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  View,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AppText, Overline } from "../components/ui";
import { useReducedMotion } from "../components/motion";
import { Icon } from "../components/icon";
import { PopoverSurface, usePopover } from "../components/popover";
import { Tappable } from "../components/tappable";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

/** Card header: an overline names the card, with optional controls on the right. */
export function JournalHeading({
  title,
  leading,
  children,
  style,
}: PropsWithChildren<{ title: string; leading?: ReactNode; style?: StyleProp<ViewStyle> }>) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 32,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
        {leading}
        <Overline accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Overline>
      </View>
      {children}
    </View>
  );
}

/** An inline editor inside a card, set apart by a hairline instead of a nested card. */
export function EditorSection(props: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          gap: spacing.md,
          marginTop: spacing.xs,
          paddingTop: spacing.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        props.style,
      ]}
    />
  );
}

/** One strong figure with a smaller muted unit. */
export function JournalFigure({
  value,
  unit,
  size = 32,
}: {
  value: string;
  unit?: string;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
      <AppText
        variant="hero"
        style={{ fontSize: size, lineHeight: Math.round(size * 1.15), letterSpacing: -size / 32 }}
      >
        {value}
      </AppText>
      {unit && (
        <AppText variant="label" muted>
          {unit}
        </AppText>
      )}
    </View>
  );
}
/**
 * A compact choice: a pill showing the current value that opens a list of the others. On web
 * the list hangs from the pill; on phones it is a centered card over a dimmed screen.
 */
export function JournalDisclosure<T extends string | number>({
  label,
  values,
  value,
  onChange,
  align = "right",
}: {
  label: string;
  values: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  /** The edge of the trigger that the popover lines up with. */
  align?: "left" | "right";
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const trigger = useRef<View>(null),
    list = useRef<View>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  const popover = usePopover({ open, onDismiss: dismiss, trigger, container: list });
  useFocusEffect(useCallback(() => dismiss, [dismiss]));
  const choices = values.map((option) => {
    const chosen = value === option.value;
    return (
      <Tappable
        key={option.value}
        label={option.label}
        selected={chosen}
        feedback="fill"
        onPress={() => {
          onChange(option.value);
          popover.close();
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.tile,
          backgroundColor: chosen ? colors.muted : "transparent",
        }}
      >
        <AppText
          variant="label"
          numberOfLines={2}
          style={{
            flex: 1,
            fontSize: 14,
            color: chosen ? colors.foreground : colors.mutedForeground,
          }}
        >
          {option.label}
        </AppText>
        {chosen && <Icon name="check" size={16} color={colors.primary} />}
      </Tappable>
    );
  });
  const surface = { borderRadius: radius.control + 2, padding: 6 } as const;
  return (
    <View style={{ zIndex: 2 }}>
      <Tappable
        ref={trigger}
        label={label}
        expanded={open}
        feedback="fill"
        onPress={() => setOpen((shown) => !shown)}
        surfaceHeight={32}
        surface={{
          minHeight: 32,
          paddingLeft: spacing.md,
          paddingRight: 10,
          gap: 6,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: radius.pill,
          backgroundColor: open ? colors.accent : colors.muted,
        }}
      >
        <AppText
          variant="label"
          numberOfLines={1}
          style={{ fontSize: 13, lineHeight: 18, flexShrink: 1 }}
        >
          {values.find((v) => v.value === value)?.label}
        </AppText>
        <Icon
          name={open ? "chevron-up" : "chevron-down"}
          size={13}
          color={colors.mutedForeground}
        />
      </Tappable>
      {open &&
        (Platform.OS === "web" ? (
          // The menu grows out of the trigger's corner.
          <PopoverSurface
            ref={list}
            origin={align === "left" ? "top left" : "top right"}
            style={[
              surface,
              { position: "absolute", top: 42, minWidth: 168, maxWidth: 300 },
              align === "left" ? { left: 0 } : { right: 0 },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              style={{ maxHeight: 240, flexGrow: 0 }}
            >
              {choices}
            </ScrollView>
          </PopoverSurface>
        ) : (
          <Modal
            transparent
            animationType={reduced ? "none" : "fade"}
            visible
            onRequestClose={dismiss}
          >
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
            >
              {/* The native backdrop: a tap outside closes the list; not a control itself. */}
              <Pressable
                accessible={false}
                onPress={dismiss}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "rgba(14, 15, 17, 0.45)",
                }}
              />
              <PopoverSurface
                ref={list}
                origin="center"
                accessibilityViewIsModal
                style={[surface, { width: "100%", maxWidth: 340, maxHeight: "80%", gap: 6 }]}
              >
                <Overline
                  accessibilityRole="header"
                  style={{ padding: spacing.md, paddingBottom: 4 }}
                >
                  {label}
                </Overline>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  style={{ maxHeight: 360, flexGrow: 0 }}
                >
                  {choices}
                </ScrollView>
              </PopoverSurface>
            </View>
          </Modal>
        ))}
    </View>
  );
}
