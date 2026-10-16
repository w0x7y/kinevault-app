import { useState, type Ref } from "react";
import { TextInput, View } from "react-native";
import { Tappable } from "../components/tappable";
import { inputSurface } from "../components/text-field";
import { AppText } from "../components/ui";
import { Icon, type IconName } from "../components/icon";
import { useTheme } from "../theme/provider";
import { cardShadow, fonts, radius, spacing } from "../theme/tokens";

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
  const searchDisabled = props.kind === "food" ? props.searchDisabled : props.disabled;
  const field = inputSurface(colors, { focused });
  const searchBox = (
    <View
      testID={`${kind}-search-box`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: field.minHeight,
        paddingLeft: spacing.layout,
        paddingRight: spacing.xs,
        borderWidth: field.borderWidth,
        borderRadius: field.borderRadius,
        borderColor: focused ? field.borderColor : colors.border,
        // The search field sits on the page, so it takes the card color rather than a sunken well.
        backgroundColor: colors.card,
        boxShadow: focused ? undefined : cardShadow(colors),
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
        editable={!searchDisabled}
        onChangeText={onQueryChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        maxLength={100}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 48,
          paddingVertical: spacing.md,
          color: colors.foreground,
          fontFamily: fonts.medium,
          fontSize: 16,
          outlineWidth: 0,
          outlineStyle: "solid",
        }}
      />
      {query.length > 0 && (
        <Tappable
          label="Clear search"
          disabled={searchDisabled}
          onPress={() => onQueryChange("")}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          surface={({ pressed }) => ({
            width: 26,
            height: 26,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.accent : colors.muted,
          })}
        >
          <Icon name="xmark" size={15} color={colors.mutedForeground} />
        </Tappable>
      )}
    </View>
  );
  return (
    <View testID={`${kind}-search-actions`} style={{ gap: spacing.md }}>
      {searchBox}
      {/* Three equal quiet tiles, 8px apart: icon above a short label that may wrap to two lines. */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {actions.map((action) => (
          <Tappable
            key={action.label}
            label={action.label}
            hint={action.hint}
            disabled={action.disabled}
            onPress={action.onPress}
            // Paddings net of the ring's 2 pt border.
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 64,
              paddingHorizontal: spacing.sm - 2,
              paddingTop: spacing.md - 3,
              paddingBottom: spacing.md - 4,
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 6,
              borderRadius: radius.control,
              backgroundColor: pressed ? colors.accent : colors.muted,
            })}
          >
            <Icon name={action.icon} size={20} color={colors.primary} />
            <AppText
              variant="caption"
              numberOfLines={2}
              style={{
                color: colors.foreground,
                fontFamily: fonts.semibold,
                fontSize: 12.5,
                lineHeight: 16,
                textAlign: "center",
              }}
            >
              {/* Longer labels keep their last two words together: "Create food / or meal". */}
              {action.label.split(" ").length > 2
                ? action.label.replace(/ (\S+)$/, "\u00a0$1")
                : action.label}
            </AppText>
          </Tappable>
        ))}
      </View>
    </View>
  );
}
