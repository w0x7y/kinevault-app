import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { AppButton, ButtonRow } from "../../components/button";
import { AppText } from "../../components/ui";
import { useConnectivity } from "../../connectivity/provider";
import { useTheme } from "../../theme/provider";
import { radius, spacing } from "../../theme/tokens";
import { ExerciseField } from "../controls";
import type { CatalogLink } from "../model";
import type { CatalogExercise } from "./catalog";
import { createDemoCatalogSearch } from "./catalog-search";
import { DemoThumbnail, ExerciseDemo } from "./exercise-demo";
import { useDemoCatalog } from "./provider";
import { RetryButton } from "./retry-button";
import { StatusLine } from "./status-line";

function DemoResult({
  entry,
  disabled,
  onPress,
}: {
  entry: CatalogExercise;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const metadata = [entry.muscleGroup, entry.equipment].filter(Boolean).join(" · ");
  return (
    <Pressable
      testID="kinevault-demo-result"
      accessibilityRole="button"
      accessibilityLabel={`Link ${entry.name}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        padding: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderRadius: radius.control,
        backgroundColor: pressed ? colors.accent : colors.secondary,
      })}
    >
      <DemoThumbnail link={entry} />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <AppText variant="label">{entry.name}</AppText>
        {Boolean(metadata) && (
          <AppText variant="caption" muted>
            {metadata}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

function searchStatus({
  failed,
  offline,
  searching,
  results,
}: {
  failed: boolean;
  offline: boolean;
  searching: boolean;
  results: readonly CatalogExercise[];
}) {
  if (failed)
    return offline
      ? "Connect to search KineVault demos."
      : "KineVault demos aren't available right now. Try again later.";
  if (!searching) return "";
  if (!results.length) return "No KineVault exercises found. Try another name.";
  return `${results.length} KineVault ${results.length === 1 ? "exercise" : "exercises"} found.`;
}

/** The exercise form's KineVault demo: search and link, or preview and unlink. */
export function KineVaultDemoSection({
  link,
  exerciseName,
  focusSearch = false,
  disabled,
  onLink,
  onUnlink,
}: {
  link: CatalogLink | undefined;
  exerciseName: string;
  focusSearch?: boolean;
  disabled: boolean;
  onLink: (entry: CatalogExercise) => void;
  onUnlink: () => void;
}) {
  const catalog = useDemoCatalog();
  const offline = useConnectivity() === "offline";
  const { refreshIfStale } = catalog;
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  // Change and Unlink replace the button that was pressed with the search, so
  // the search takes focus rather than leaving it nowhere.
  const [focusOnMount, setFocusOnMount] = useState(focusSearch);
  // Keeping the current demo or choosing a result swaps the pressed control for the linked
  // view, so Change takes focus there.
  const changeButton = useRef<View>(null);
  const focusChange = useRef(false);
  useEffect(() => {
    void refreshIfStale();
  }, [refreshIfStale]);
  const entries = catalog.state.kind === "ready" ? catalog.state.entries : null;
  const search = useMemo(() => createDemoCatalogSearch(entries ?? []), [entries]);
  const results = query.trim() ? search(query) : [];
  const linked =
    link && catalog.state.kind === "ready" ? catalog.state.byId.get(link.id) : undefined;
  const failed = catalog.state.kind === "failed";
  const statusText = searchStatus({ failed, offline, searching: query.trim() !== "", results });
  const label = exerciseName.trim() || "this exercise";
  const showLinked = link !== undefined && !changing;
  useEffect(() => {
    if (!showLinked || !focusChange.current) return;
    focusChange.current = false;
    if (Platform.OS === "web") changeButton.current?.focus();
  }, [showLinked]);
  return (
    <View testID="kinevault-demo" style={{ gap: spacing.layout }}>
      <AppText variant="label">KineVault demo</AppText>
      {showLinked ? (
        <>
          <ExerciseDemo key={link.id} link={link} label={label} />
          <AppText variant="caption" muted>
            {`Linked to ${linked?.name ?? "a KineVault exercise"}`}
          </AppText>
          <ButtonRow>
            <AppButton
              ref={changeButton}
              label="Change"
              accessibilityLabel="Change KineVault demo"
              fill
              disabled={disabled}
              onPress={() => {
                setFocusOnMount(true);
                setChanging(true);
              }}
            />
            <AppButton
              label="Unlink"
              accessibilityLabel="Unlink KineVault demo"
              fill
              disabled={disabled}
              onPress={() => {
                setFocusOnMount(true);
                onUnlink();
              }}
            />
          </ButtonRow>
        </>
      ) : (
        <>
          {!failed && (
            <ExerciseField
              label="Find in KineVault"
              value={query}
              onChange={setQuery}
              disabled={disabled || catalog.state.kind === "loading"}
              autoFocus={focusOnMount}
            />
          )}
          <StatusLine text={statusText} />
          {failed ? (
            <RetryButton
              accessibilityLabel="Retry loading KineVault demos"
              onRetry={catalog.retry}
            />
          ) : (
            results.map((entry) => (
              <DemoResult
                key={entry.id}
                entry={entry}
                disabled={disabled}
                onPress={() => {
                  focusChange.current = true;
                  onLink(entry);
                  setChanging(false);
                  setQuery("");
                }}
              />
            ))
          )}
        </>
      )}
      {link !== undefined && changing && (
        <AppButton
          label="Keep current demo"
          disabled={disabled}
          onPress={() => {
            focusChange.current = true;
            setChanging(false);
          }}
        />
      )}
    </View>
  );
}
