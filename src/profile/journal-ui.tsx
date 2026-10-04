import { useEffect, useState, type PropsWithChildren } from "react";
import {
  BackHandler,
  Platform,
  Modal,
  ScrollView,
  Pressable,
  View,
  type TextProps,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { useTheme } from "../theme/provider";

export function JournalText({
  size = 13,
  lineHeight = size * 1.55,
  ...props
}: TextProps & {
  size?: number;
  lineHeight?: number;
  muted?: boolean;
  variant?: "body" | "heading" | "label" | "caption";
}) {
  return (
    <AppText {...props} style={[{ fontSize: size, lineHeight }, props.style]} />
  );
}
export function JournalPanel(props: ViewProps) {
  return <Panel {...props} style={[{ gap: 0 }, props.style]} />;
}
export function JournalAction({
  label,
  accessibilityLabel,
  icon,
  onPress,
  disabled,
  style,
  size = 11,
}: {
  size?: number;
  label: string;
  accessibilityLabel?: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          marginVertical: -3,
          paddingHorizontal: 3,
          flexDirection: "row",
          gap: 6,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={12} color={colors.primary} />}
      <JournalText
        size={size}
        variant="label"
        style={{ color: colors.primary }}
      >
        {label}
      </JournalText>
    </Pressable>
  );
}
export function JournalHeading({
  title,
  children,
  style,
}: PropsWithChildren<{ title: string; style?: StyleProp<ViewStyle> }>) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 38,
          marginTop: -3,
          marginBottom: 8,
          gap: 6,
        },
        style,
      ]}
    >
      <JournalText
        size={14}
        variant="heading"
        accessibilityRole="header"
        style={{ flexShrink: 1 }}
      >
        {title}
      </JournalText>
      {children}
    </View>
  );
}
export function JournalDisclosure<T extends string | number>({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      setOpen(false);
      return true;
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    if (Platform.OS === "web") document.addEventListener("keydown", escape);
    return () => {
      back.remove();
      if (Platform.OS === "web")
        document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const choices = values.map((option) => (
    <Pressable
      key={option.value}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityState={{ selected: value === option.value }}
      aria-pressed={value === option.value}
      onPress={() => {
        onChange(option.value);
        setOpen(false);
      }}
      style={{
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor:
          value === option.value ? colors.secondary : colors.card,
      }}
    >
      <JournalText size={10}>{option.label}</JournalText>
    </Pressable>
  ));
  return (
    <View style={{ zIndex: 2 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen((v) => !v)}
        style={{ height: 44, marginVertical: -4, justifyContent: "center" }}
      >
        <View
          style={{
            minHeight: 36,
            paddingHorizontal: 8,
            gap: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 9,
            backgroundColor: colors.card,
          }}
        >
          <JournalText size={9}>
            {values.find((v) => v.value === value)?.label}
          </JournalText>
          <Icon name="chevron-down" size={6} color={colors.foreground} />
        </View>
      </Pressable>
      {open &&
        (Platform.OS === "web" ? (
          <View
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              minWidth: 110,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: 9,
              padding: 4,
            }}
          >
            <ScrollView
              nestedScrollEnabled
              style={{ maxHeight: 240, flexGrow: 0 }}
            >
              {choices}
            </ScrollView>
          </View>
        ) : (
          <Modal
            transparent
            animationType="fade"
            visible
            onRequestClose={() => setOpen(false)}
          >
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
            >
              <Pressable
                accessible={false}
                onPress={() => setOpen(false)}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "rgba(0,0,0,.5)",
                }}
              />
              <View
                accessibilityViewIsModal
                style={{
                  width: "100%",
                  maxWidth: 320,
                  maxHeight: "80%",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 18,
                  padding: 12,
                  backgroundColor: colors.card,
                  gap: 8,
                }}
              >
                <JournalText
                  size={14}
                  variant="heading"
                  accessibilityRole="header"
                >
                  {label}
                </JournalText>
                <ScrollView
                  nestedScrollEnabled
                  style={{ maxHeight: 360, flexGrow: 0 }}
                >
                  {choices}
                </ScrollView>
              </View>
            </View>
          </Modal>
        ))}
    </View>
  );
}
