import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useAccountStorage } from "../../account/storage-context";
import { AppButton } from "../../components/button";
import { Icon } from "../../components/icon";
import { KineLoading } from "../../components/kine-loading";
import { AppText, Panel } from "../../components/ui";
import { useConnectivity } from "../../connectivity/provider";
import { useTheme } from "../../theme/provider";
import { fonts, radius, spacing } from "../../theme/tokens";
import { ExerciseError } from "../controls";
import { exerciseStorageKey } from "../persistence";
import { useExercises } from "../provider";
import { createWorkoutImportFlow } from "./import-flow";
import { previewWorkoutImport, type WorkoutImportRow } from "./mapping";
import { capitalizeWords } from "./tracked-page";
import { workoutImportSources, type WorkoutImportSource } from "./sources";

const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? "" : "s"}`;

export function WorkoutImport({
  initialSource,
  onClose,
  onOpenLibrary,
}: {
  initialSource?: string;
  onClose: () => void;
  onOpenLibrary: () => void;
}) {
  const store = useExercises(),
    storeRef = useRef(store);
  storeRef.current = store;
  const offline = useConnectivity() === "offline";
  const storage = useAccountStorage();
  const sync = useSyncExternalStore(storage.subscribe, storage.getSnapshot, storage.getSnapshot);
  const conflict = sync.conflicts.includes(exerciseStorageKey);
  const [flow] = useState(() =>
    createWorkoutImportFlow({
      sources: workoutImportSources,
      initialSource,
      importPlan: (plan) => storeRef.current.importWorkoutPlan(plan),
    }),
  );
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  useLayoutEffect(() => {
    flow.start();
    return flow.stop;
  }, [flow]);
  const document = store.state.kind === "ready" ? store.state.document : null;
  const plan = state.step === "preview" ? state.plan : null;
  const preview = useMemo(
    () => (document && plan ? previewWorkoutImport(document, plan) : null),
    [document, plan],
  );
  const source =
    state.step === "sources" ? null : workoutImportSources.find((item) => item.id === state.source);

  if (state.step === "sources")
    return (
      <Panel testID="workout-import">
        <AppText variant="heading" accessibilityRole="header">
          Import workouts
        </AppText>
        <AppText muted>Choose the app your workout comes from.</AppText>
        {workoutImportSources.map((item) => (
          <SourceButton key={item.id} source={item} onPress={() => flow.choose(item.id)} />
        ))}
        <AppButton label="Close import" onPress={onClose} />
      </Panel>
    );

  if (state.step === "link") {
    // The keyboard's Go key follows the same rules as the Get workout button.
    const canLoad = !offline && !state.loading && state.text.trim() !== "";
    const load = () => {
      if (canLoad) void flow.load();
    };
    return (
      <Panel testID="workout-import">
        <AppText variant="heading" accessibilityRole="header">
          Import from {source?.label}
        </AppText>
        {source?.unavailable ? (
          <AppText>{source.unavailable}</AppText>
        ) : (
          <>
            <AppText muted>{source?.help}</AppText>
            <LinkField
              label={source?.inputLabel ?? "Link"}
              placeholder={source?.placeholder}
              value={state.text}
              disabled={state.loading}
              onChange={flow.setText}
              onSubmit={load}
            />
            {offline && (
              <AppText muted accessibilityLiveRegion="polite">
                You're offline. Connect to the internet to get the workout.
              </AppText>
            )}
            {state.loading && <KineLoading compact label="Getting workout..." />}
            <ExerciseError message={state.error} />
            {state.loading ? (
              <AppButton label="Cancel" onPress={flow.cancel} />
            ) : (
              <AppButton primary label="Get workout" disabled={!canLoad} onPress={load} />
            )}
          </>
        )}
        <AppButton label="Back" accessibilityLabel="Back to import sources" onPress={flow.back} />
      </Panel>
    );
  }

  if (state.step === "preview")
    return (
      <Panel testID="workout-import">
        {preview ? (
          <>
            <AppText variant="heading" accessibilityRole="header">
              {preview.name}
            </AppText>
            <AppText variant="caption" muted>
              {[
                preview.category && capitalizeWords(preview.category),
                count(preview.rows.length, "exercise"),
                `${preview.newExercises} new to your library`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </AppText>
            {preview.replacing && (
              <AppText>
                You imported this workout before. Importing again replaces the saved workout "
                {preview.replacing.name}". Logged workouts stay the same.
              </AppText>
            )}
            {preview.repeated.map((item) => (
              <AppText key={item.name} variant="caption" muted>
                {item.name} appears {item.count} times. It's added once with{" "}
                {count(item.sets, "set")}.
              </AppText>
            ))}
            {preview.rows.some((row) => row.sidesFromName) && (
              <AppText variant="caption" muted>
                New exercises with Unilateral in the name track left and right sides. You can change
                this in the exercise.
              </AppText>
            )}
            <View testID="workout-import-rows">
              {preview.rows.map((row, index) => (
                <ImportRow key={row.key} row={row} first={index === 0} />
              ))}
            </View>
            {offline && (
              <AppText variant="caption" muted>
                You're offline. The workout saves on this device and syncs when you reconnect.
              </AppText>
            )}
            {conflict && (
              <ExerciseError message="Your exercises changed on another device. Choose the copy to keep in Settings, then import." />
            )}
            <ExerciseError message={preview.problem} />
            <ExerciseError message={state.error} />
            <AppButton
              primary
              label={
                state.saving
                  ? "Importing…"
                  : preview.replacing
                    ? "Replace workout"
                    : "Import workout"
              }
              busy={state.saving}
              disabled={state.saving || conflict || preview.problem !== null}
              onPress={() => void flow.confirm()}
            />
          </>
        ) : (
          <AppText>Your exercises are loading. Try again in a moment.</AppText>
        )}
        <AppButton
          label="Back"
          accessibilityLabel="Back to the link"
          disabled={state.saving}
          onPress={flow.back}
        />
      </Panel>
    );

  const { result } = state;
  return (
    <Panel testID="workout-import">
      <AppText variant="heading" accessibilityRole="header">
        Workout imported
      </AppText>
      <AppText accessibilityLiveRegion="polite">
        {result.name} is in Saved workouts with {count(result.exercises, "exercise")}.{" "}
        {result.created
          ? `${count(result.created, "new exercise")} added to your library.`
          : "All its exercises were already in your library."}
        {result.replaced ? " It replaced your earlier import." : ""}
      </AppText>
      <AppButton primary label="Open saved workouts" onPress={onOpenLibrary} />
      <AppButton label="Done" accessibilityLabel="Close import" onPress={onClose} />
    </Panel>
  );
}

function SourceButton({ source, onPress }: { source: WorkoutImportSource; onPress: () => void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Import from ${source.label}`}
      accessibilityHint={source.summary}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.layout,
        padding: spacing.layout,
        borderWidth: focused ? 2 : 1,
        borderRadius: radius.control,
        borderColor: focused ? colors.ring : colors.border,
        backgroundColor: pressed ? colors.accent : colors.secondary,
      })}
    >
      <Icon name="link" size={18} color={colors.secondaryForeground} />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <AppText variant="label" style={{ color: colors.secondaryForeground }}>
          {source.label}
        </AppText>
        <AppText variant="caption" muted>
          {source.summary}
        </AppText>
      </View>
      <Icon name="arrow-right" size={16} color={colors.secondaryForeground} />
    </Pressable>
  );
}

function LinkField({
  label,
  placeholder,
  value,
  disabled,
  onChange,
  onSubmit,
}: {
  label: string;
  placeholder?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs, minWidth: 0 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        keyboardType="url"
        inputMode="url"
        returnKeyType="go"
        maxLength={2000}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={colors.ring}
        style={{
          minHeight: 48,
          minWidth: 0,
          padding: spacing.layout,
          borderWidth: 1,
          borderRadius: radius.control,
          borderColor: focused ? colors.ring : colors.border,
          backgroundColor: colors.background,
          color: colors.foreground,
          fontFamily: fonts.regular,
          fontSize: 16,
        }}
      />
    </View>
  );
}

function ImportRow({ row, first }: { row: WorkoutImportRow; first: boolean }) {
  const { colors } = useTheme();
  const status =
    row.status === "library"
      ? "In your library"
      : row.sidesFromName
        ? "New · Left and right"
        : "New";
  return (
    <View
      accessible
      accessibilityLabel={[row.label, row.name, row.prescription, status]
        .filter(Boolean)
        .join(", ")}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderTopWidth: first ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          minWidth: 44,
          paddingHorizontal: spacing.xs,
          paddingVertical: 2,
          alignItems: "center",
          borderRadius: 8,
          backgroundColor: colors.secondary,
        }}
      >
        <AppText variant="label" style={{ color: colors.secondaryForeground }}>
          {row.label}
        </AppText>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label">{row.name}</AppText>
        {row.prescription ? (
          <AppText variant="caption" muted>
            {row.prescription}
          </AppText>
        ) : null}
        <AppText
          variant="caption"
          style={{ color: row.status === "new" ? colors.primary : colors.mutedForeground }}
        >
          {status}
        </AppText>
      </View>
    </View>
  );
}
