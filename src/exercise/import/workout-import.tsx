import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { View } from "react-native";
import { useAccountStorage } from "../../account/storage-context";
import { AppButton } from "../../components/button";
import { Icon, type IconName } from "../../components/icon";
import { IconWell } from "../../components/icon-well";
import { KineLoading } from "../../components/kine-loading";
import { StepFade } from "../../components/motion";
import { Tappable } from "../../components/tappable";
import { AppText, Overline, Panel } from "../../components/ui";
import { useConnectivity } from "../../connectivity/provider";
import { useTheme } from "../../theme/provider";
import { fonts, radius, spacing } from "../../theme/tokens";
import { InlineMessage } from "../../components/inline-message";
import { TextField } from "../../components/text-field";
import { ViewHeader } from "../../components/view-header";
import { useSheetBack } from "../../components/sheet-page";
import { exerciseStorageKey } from "../persistence";
import type { LibraryDrafts } from "../library-drafts";
import { useExercises } from "../provider";
import { previewWorkoutImport, type WorkoutImportRow } from "./mapping";
import { capitalizeWords } from "./tracked-page";
import { workoutImportSources, type WorkoutImportSource } from "./sources";

const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? "" : "s"}`;

export function WorkoutImport({
  flow,
  onClose,
  onOpenLibrary,
}: {
  /** The journey, kept by the panel that opened it while this page is away. */
  flow: ReturnType<LibraryDrafts["workoutImport"]>;
  onClose: () => void;
  onOpenLibrary: () => void;
}) {
  const theme = useTheme();
  const store = useExercises();
  const offline = useConnectivity() === "offline";
  const storage = useAccountStorage();
  const sync = useSyncExternalStore(storage.subscribe, storage.getSnapshot, storage.getSnapshot);
  const conflict = sync.conflicts.includes(exerciseStorageKey);
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const document = store.state.kind === "ready" ? store.state.document : null;
  const plan = state.step === "preview" ? state.plan : null;
  const preview = useMemo(
    () => (document && plan ? previewWorkoutImport(document, plan) : null),
    [document, plan],
  );
  const source =
    state.step === "sources" ? null : workoutImportSources.find((item) => item.id === state.source);
  // The sheet's back button steps back through the import, and closes it from the first and
  // last steps.
  useSheetBack(
    state.step === "link"
      ? { label: "Back to import sources", onPress: flow.back }
      : state.step === "preview"
        ? { label: "Back to the link", onPress: flow.back, disabled: state.saving }
        : {},
  );

  // Each step replaces the last on the sheet with a short fade.
  return <StepFade step={state.step}>{renderStep()}</StepFade>;

  function renderStep() {
    if (state.step === "sources")
      return (
        <Panel style={{ gap: spacing.layout }}>
          <AppText variant="label" muted style={{ fontFamily: fonts.medium }}>
            Choose the app your workout comes from.
          </AppText>
          <View style={{ gap: spacing.sm }}>
            {workoutImportSources.map((item) => (
              <SourceButton key={item.id} source={item} onPress={() => flow.choose(item.id)} />
            ))}
          </View>
        </Panel>
      );

    if (state.step === "link") {
      // The keyboard's Go key follows the same rules as the Get workout button.
      const canLoad = !offline && !state.loading && state.text.trim() !== "";
      const load = () => {
        if (canLoad) void flow.load();
      };
      return (
        <Panel style={{ gap: spacing.layout }}>
          <ViewHeader title={`Import from ${source?.label ?? "another app"}`} />
          {source?.unavailable ? (
            <Notice icon="circle-info">{source.unavailable}</Notice>
          ) : (
            <>
              <AppText variant="label" muted style={{ fontFamily: fonts.medium }}>
                {source?.help}
              </AppText>
              <TextField
                label={source?.inputLabel ?? "Link"}
                labelTone="muted"
                kind="url"
                placeholder={source?.placeholder}
                value={state.text}
                disabled={state.loading}
                onChange={flow.setText}
                returnKeyType="go"
                onSubmit={load}
              />
              {offline && (
                <AppText variant="caption" muted accessibilityLiveRegion="polite">
                  You're offline. Connect to the internet to get the workout.
                </AppText>
              )}
              {state.loading && <KineLoading compact label="Getting workout..." />}
              <InlineMessage>{state.error}</InlineMessage>
              {state.loading ? (
                <AppButton label="Cancel" onPress={flow.cancel} />
              ) : (
                <AppButton tone="primary" label="Get workout" disabled={!canLoad} onPress={load} />
              )}
            </>
          )}
        </Panel>
      );
    }

    if (state.step === "preview")
      return (
        <Panel style={{ gap: spacing.layout }}>
          {preview ? (
            <>
              <ViewHeader title={preview.name} overline="Import preview">
                <AppText variant="caption" muted>
                  {[
                    preview.category && capitalizeWords(preview.category),
                    count(preview.exerciseCount, "exercise"),
                    `${preview.newExercises} new to your library`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
              </ViewHeader>
              {preview.replacing && (
                <Notice icon="triangle-exclamation">
                  You imported this workout before. Importing again replaces the saved workout "
                  {preview.replacing.name}". Logged workouts stay the same.
                </Notice>
              )}
              {offline && (
                <AppText variant="caption" muted>
                  You're offline. The workout saves on this device and syncs when you reconnect.
                </AppText>
              )}
              {conflict && (
                <InlineMessage>
                  Your exercises changed on another device. Choose the copy to keep in Settings,
                  then import.
                </InlineMessage>
              )}
              <InlineMessage>{preview.problem}</InlineMessage>
              <InlineMessage>{state.error}</InlineMessage>
              {/* The action leads the long exercise list, so it never needs a long scroll. */}
              <AppButton
                tone="primary"
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
              {(preview.repeated.length > 0 || preview.rows.some((row) => row.sidesFromName)) && (
                <View style={{ gap: spacing.xs }}>
                  {preview.repeated.map((item) => (
                    <AppText key={item.name} variant="caption" muted>
                      {item.name} appears {item.count} times. It's added once with{" "}
                      {count(item.sets, "set")}.
                    </AppText>
                  ))}
                  {preview.rows.some((row) => row.sidesFromName) && (
                    <AppText variant="caption" muted>
                      New exercises with Unilateral in the name track left and right sides. You can
                      change this in the exercise.
                    </AppText>
                  )}
                </View>
              )}
              <Overline style={{ marginTop: spacing.xs }}>Exercises</Overline>
              <View testID="workout-import-rows">
                {preview.rows.map((row, index) => (
                  <ImportRow key={row.key} row={row} first={index === 0} />
                ))}
              </View>
            </>
          ) : (
            <>
              <ViewHeader title="Import preview" />
              <AppText>Your exercises are loading. Try again in a moment.</AppText>
            </>
          )}
        </Panel>
      );

    const { result } = state;
    const { colors } = theme;
    return (
      <Panel style={{ gap: spacing.layout }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.tile,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.muted,
          }}
        >
          <Icon name="circle-check" size={24} color={colors.success} />
        </View>
        <AppText variant="title" accessibilityRole="header">
          Workout imported
        </AppText>
        <AppText muted accessibilityLiveRegion="polite">
          {result.name} is in Saved workouts with {count(result.exercises, "exercise")}.{" "}
          {result.created
            ? `${count(result.created, "new exercise")} added to your library.`
            : "All its exercises were already in your library."}
          {result.replaced ? " It replaced your earlier import." : ""}
        </AppText>
        <AppButton tone="primary" label="Open saved workouts" onPress={onOpenLibrary} />
        <AppButton label="Done" onPress={onClose} />
      </Panel>
    );
  }
}

function SourceButton({ source, onPress }: { source: WorkoutImportSource; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Tappable
      label={`Import from ${source.label}`}
      hint={source.summary}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 68,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        paddingRight: spacing.card,
        borderRadius: radius.control + 4,
        backgroundColor: pressed ? colors.accent : colors.muted,
      })}
    >
      <IconWell icon="link" color={colors.primary} background="card" size="large" />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" style={{ fontSize: 16, lineHeight: 22, fontFamily: fonts.bold }}>
          {source.label}
        </AppText>
        <AppText variant="caption" muted>
          {source.summary}
        </AppText>
      </View>
      <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
    </Tappable>
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
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          minWidth: 40,
          paddingHorizontal: spacing.xs,
          paddingVertical: 3,
          alignItems: "center",
          borderRadius: radius.tile - 4,
          backgroundColor: colors.secondary,
        }}
      >
        <AppText
          variant="caption"
          style={{ color: colors.secondaryForeground, fontFamily: fonts.bold }}
        >
          {row.label}
        </AppText>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" style={{ fontSize: 15 }}>
          {row.name}
        </AppText>
        {row.prescription ? (
          <AppText variant="caption" muted>
            {row.prescription}
          </AppText>
        ) : null}
        <AppText
          variant="caption"
          style={{
            color: row.status === "new" ? colors.brand : colors.mutedForeground,
            fontFamily: row.status === "new" ? fonts.bold : fonts.medium,
          }}
        >
          {status}
        </AppText>
      </View>
    </View>
  );
}

/** A calm callout for information the user should read before going on. */
function Notice({ icon, children }: { icon: IconName; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.control,
        backgroundColor: colors.muted,
      }}
    >
      <Icon name={icon} size={17} color={colors.primary} style={{ marginTop: 1 }} />
      <AppText variant="label" style={{ flex: 1, fontFamily: fonts.medium }}>
        {children}
      </AppText>
    </View>
  );
}
