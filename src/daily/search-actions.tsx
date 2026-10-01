import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { KineSplitRow } from "../components/kine-split-row";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

export function SearchActions({ kind, query, onQueryChange }: {
  kind: "food" | "exercise";
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const label = kind === "food" ? "Search foods" : "Search exercises";
  const actions: { label: string; icon: IconName }[] = kind === "food" ? [
    { label: "Create Foods", icon: "circle-plus" },
    { label: "View macros for the day", icon: "chart-pie" },
  ] : [
    { label: "Create Exercise", icon: "circle-plus" },
    { label: "Create Workouts", icon: "clipboard-list" },
  ];
  return (
    <View testID={`${kind}-search-actions`} style={{ gap: spacing.layout }}>
      <View testID={`${kind}-search-box`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.layout, paddingHorizontal: spacing.layout,
        borderWidth: 1, borderRadius: radius.control, borderColor: focused ? colors.ring : colors.border,
        backgroundColor: colors.card }}>
        <Icon name="magnifying-glass" size={18} color={colors.mutedForeground} />
        <TextInput
          accessibilityLabel={label}
          accessibilityHint="Filters entries logged for the selected day"
          placeholder={label}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.ring}
          value={query}
          onChangeText={onQueryChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
          maxLength={100}
          style={{ flex: 1, minWidth: 0, minHeight: 52, paddingVertical: spacing.layout,
            color: colors.foreground, fontFamily: fonts.regular, fontSize: 15,
            outlineWidth: 0, outlineStyle: "solid" }}
        />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search"
            onPress={() => onQueryChange("")}
            style={({ pressed }) => ({ width: 44, minHeight: 44, alignItems: "center", justifyContent: "center",
              backgroundColor: pressed ? colors.accent : "transparent", borderRadius: 8 })}>
            <Icon name="xmark" size={18} color={colors.primary} />
          </Pressable>
        )}
      </View>
      <KineSplitRow pose={kind} testIDPrefix={kind}>
        <View style={{ flexGrow: 1, flexShrink: 0, gap: spacing.layout }}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ disabled: true }}
              accessibilityHint="Coming soon"
              disabled
              style={{
                flexGrow: 1,
                minHeight: 72,
                paddingHorizontal: spacing.layout,
                paddingVertical: spacing.layout,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.control,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondary,
              }}
            >
              <View style={{ position: "absolute", left: 8, top: 8 }}>
                <Icon name={action.icon} size={12} color={colors.secondaryForeground} />
              </View>
              <AppText
                variant="label"
                style={{ color: colors.secondaryForeground, textAlign: "center", width: "100%" }}
              >
                {action.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </KineSplitRow>
    </View>
  );
}
