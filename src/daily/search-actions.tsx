import { useState, type Ref } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { KineSplitRow } from "../components/kine-split-row";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

type SearchActionsProps = {
  inputRef?: Ref<TextInput>;
  query: string;
  onQueryChange: (query: string) => void;
} & ({ kind: "food"; onViewMacros: () => void; macrosDisabled: boolean;
  onCreateItem: () => void; createDisabled: boolean; searchDisabled: boolean;
  onScanBarcode: () => void } | { kind: "exercise" });

export function SearchActions(props: SearchActionsProps) {
  const { kind, query, onQueryChange } = props;
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const label = props.kind === "food" ? "Search foods" : "Search exercises";
  const actions: { label: string; icon: IconName; hint?: string; onPress?: () => void; disabled?: boolean }[] = props.kind === "food" ? [
    { label: "Create food/meal", icon: "circle-plus", onPress: props.onCreateItem, disabled: props.createDisabled,
      hint: "Create a reusable food or a meal made from foods" },
    { label: "View macros for the day", icon: "chart-pie", onPress: props.onViewMacros, disabled: props.macrosDisabled,
      hint: "Shows nutrition totals for the selected day" },
  ] : [
    { label: "Create Exercise", icon: "circle-plus" },
    { label: "Create Workouts", icon: "clipboard-list" },
  ];
  const searchBox = (
    <View testID={`${kind}-search-box`} style={{ flexDirection: "row", alignItems: "center",
      gap: kind === "food" ? spacing.xs : spacing.layout, paddingHorizontal: kind === "food" ? spacing.sm : spacing.layout,
      borderWidth: 1, borderRadius: radius.control, borderColor: focused ? colors.ring : colors.border,
      backgroundColor: colors.card }}>
      <Icon name="magnifying-glass" size={18} color={colors.mutedForeground} />
      <TextInput
        ref={props.inputRef}
        accessibilityLabel={label}
        accessibilityHint={props.kind === "food" ? "Searches the offline food database and your saved foods and meals" : "Filters entries logged for the selected day"}
        placeholder={label}
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.ring}
        value={query}
        editable={props.kind !== "food" || !props.searchDisabled}
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
          disabled={props.kind === "food" && props.searchDisabled}
          onPress={() => onQueryChange("")}
          style={({ pressed }) => ({ width: 44, minHeight: 44, alignItems: "center", justifyContent: "center",
            backgroundColor: pressed ? colors.accent : "transparent", borderRadius: 8 })}>
          <Icon name="xmark" size={18} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
  return (
    <View testID={`${kind}-search-actions`} style={{ gap: spacing.layout }}>
      <KineSplitRow pose={kind} testIDPrefix={kind}>
        <View style={{ flexGrow: 1, flexShrink: 0, gap: spacing.layout }}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ disabled: !action.onPress || action.disabled }}
              accessibilityHint={action.hint ?? "Coming soon"}
              disabled={!action.onPress || action.disabled}
              onPress={action.onPress}
              style={({ pressed }) => ({
                flexGrow: 1,
                minHeight: 72,
                paddingHorizontal: spacing.layout,
                paddingVertical: spacing.layout,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.control,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.accent : colors.secondary,
              })}
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
      {props.kind === "food" ? (
        <View style={{ flexDirection: "row", alignItems: "stretch", gap: spacing.layout }}>
          <View style={{ flex: 3, minWidth: 0 }}>{searchBox}</View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Scan food barcode"
              accessibilityHint="Opens the camera or manual barcode entry" accessibilityState={{ disabled: props.createDisabled }}
              disabled={props.createDisabled} onPress={props.onScanBarcode}
              style={({ pressed }) => ({ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center",
                borderWidth: 1, borderColor: colors.border, borderRadius: radius.control,
                backgroundColor: pressed ? colors.accent : colors.secondary })}>
              <Icon name="barcode" size={18} color={colors.secondaryForeground} />
            </Pressable>
          </View>
        </View>
      ) : searchBox}
    </View>
  );
}
