import { useState, type Ref } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

type SearchActionsProps = {
  inputRef?: Ref<TextInput>;
  query: string;
  onQueryChange: (query: string) => void;
} & (
  | {
      kind: "food";
      onViewMacros: () => void;
      macrosDisabled: boolean;
      onCreateItem: () => void;
      createDisabled: boolean;
      searchDisabled: boolean;
      onScanBarcode: () => void;
    }
  | {
      kind: "exercise";
      onCreateExercise: () => void;
      onCreateWorkout: () => void;
      onSavedWorkouts: () => void;
      disabled: boolean;
    }
);

export function SearchActions(props: SearchActionsProps) {
  const { kind, query, onQueryChange } = props;
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const label = props.kind === "food" ? "Search foods" : "Search exercises";
  const actions: {
    label: string;
    icon: IconName;
    hint: string;
    onPress: () => void;
    disabled: boolean;
  }[] =
    props.kind === "food"
      ? [
          {
            label: "Scan barcode",
            icon: "barcode",
            onPress: props.onScanBarcode,
            disabled: props.createDisabled,
            hint: "Opens the camera or manual barcode entry",
          },
          {
            label: "Create food or meal",
            icon: "circle-plus",
            onPress: props.onCreateItem,
            disabled: props.createDisabled,
            hint: "Create a reusable food or a meal made from foods",
          },
          {
            label: "Daily macros",
            icon: "chart-pie",
            onPress: props.onViewMacros,
            disabled: props.macrosDisabled,
            hint: "Shows nutrition totals for the selected day",
          },
        ]
      : [
          {
            label: "Saved workouts",
            icon: "clipboard-list",
            onPress: props.onSavedWorkouts,
            disabled: props.disabled,
            hint: "Choose a saved workout to plan on the selected day",
          },
          {
            label: "Create workout",
            icon: "circle-plus",
            onPress: props.onCreateWorkout,
            disabled: props.disabled,
            hint: "Create an ordered reusable workout",
          },
          {
            label: "Create exercise",
            icon: "dumbbell",
            onPress: props.onCreateExercise,
            disabled: props.disabled,
            hint: "Create an exercise in your local library",
          },
        ];
  const searchBox = (
    <View
      testID={`${kind}-search-box`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderWidth: focused ? 2 : 1,
        borderRadius: radius.control,
        borderColor: focused ? colors.ring : colors.input,
        backgroundColor: colors.card,
      }}
    >
      <Icon name="magnifying-glass" size={18} color={colors.mutedForeground} />
      <TextInput
        ref={props.inputRef}
        accessibilityLabel={label}
        accessibilityHint={
          props.kind === "food"
            ? "Searches the offline food database and your saved foods and meals"
            : "Searches your saved exercise library"
        }
        placeholder={label}
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.ring}
        value={query}
        editable={props.kind === "food" ? !props.searchDisabled : !props.disabled}
        onChangeText={onQueryChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        maxLength={100}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 52,
          paddingVertical: spacing.layout,
          color: colors.foreground,
          fontFamily: fonts.regular,
          fontSize: 16,
          outlineWidth: 0,
          outlineStyle: "solid",
        }}
      />
      {query.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          disabled={props.kind === "food" ? props.searchDisabled : props.disabled}
          onPress={() => onQueryChange("")}
          style={({ pressed }) => ({
            width: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.accent : "transparent",
            borderRadius: 8,
          })}
        >
          <Icon name="xmark" size={18} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
  return (
    <View testID={`${kind}-search-actions`} style={{ gap: spacing.layout }}>
      {searchBox}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: action.disabled }}
            accessibilityHint={action.hint}
            disabled={action.disabled}
            onPress={action.onPress}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 76,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.layout,
              alignItems: "center",
              justifyContent: "flex-start",
              gap: spacing.sm,
              borderRadius: radius.control,
              backgroundColor: pressed ? colors.accent : colors.card,
              opacity: action.disabled ? 0.5 : 1,
            })}
          >
            <Icon name={action.icon} size={18} color={colors.primary} />
            <AppText variant="label" style={{ color: colors.foreground, textAlign: "center" }}>
              {action.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
