import { useEffect, useMemo, useRef } from "react";
import { Platform, View } from "react-native";
import { AppButton, ButtonRow } from "../../components/button";
import { AppText } from "../../components/ui";
import { useConnectivity } from "../../connectivity/provider";
import { useTheme } from "../../theme/provider";
import { radius, spacing } from "../../theme/tokens";
import { Icon } from "../../components/icon";
import { Tappable } from "../../components/tappable";
import { TextField } from "../../components/text-field";
import { SectionLabel } from "../controls";
import type { CatalogLink } from "../model";
import type { CatalogExercise } from "./catalog";
import { createDemoCatalogSearch } from "./catalog-search";
import { demoSearchStatus, type DemoPicker, type DemoPickerEvent } from "./demo-link";
import { DemoThumbnail, ExerciseDemo } from "./exercise-demo";
import { useDemoCatalog } from "./provider";
import { RetryButton } from "../../components/load-failure";
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
    <Tappable
      testID="kinevault-demo-result"
      label={`Link ${entry.name}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        padding: spacing.sm - 2,
        paddingRight: spacing.md - 2,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderRadius: radius.control,
        backgroundColor: pressed ? colors.accent : colors.secondary,
      })}
    >
      <DemoThumbnail link={entry} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label">{entry.name}</AppText>
        {Boolean(metadata) && (
          <AppText variant="caption" muted>
            {metadata}
          </AppText>
        )}
      </View>
      <Icon name="link" size={17} color={colors.mutedForeground} />
    </Tappable>
  );
}

/**
 * The exercise form's KineVault demo: search and link, or preview and unlink. Its search and
 * mode (`picker`) belong to the exercise's Library draft, so they survive leaving the tab.
 */
export function KineVaultDemoSection({
  link,
  exerciseName,
  picker: { query, changing, focus },
  onPick,
  disabled,
  onLink,
  onUnlink,
}: {
  link: CatalogLink | undefined;
  exerciseName: string;
  picker: DemoPicker;
  onPick: (event: Exclude<DemoPickerEvent, "linked" | "unlink">) => void;
  disabled: boolean;
  /** Links the entry and shows it; its picker mode changes with it. */
  onLink: (entry: CatalogExercise) => void;
  /** Unlinks the demo and opens the search; its picker mode changes with it. */
  onUnlink: () => void;
}) {
  const { colors } = useTheme();
  const catalog = useDemoCatalog();
  const offline = useConnectivity() === "offline";
  const { refreshIfStale } = catalog;
  const changeButton = useRef<View>(null);
  useEffect(() => {
    void refreshIfStale();
  }, [refreshIfStale]);
  const entries = catalog.state.kind === "ready" ? catalog.state.entries : null;
  const search = useMemo(() => createDemoCatalogSearch(entries ?? []), [entries]);
  const results = query.trim() ? search(query) : [];
  const linked =
    link && catalog.state.kind === "ready" ? catalog.state.byId.get(link.id) : undefined;
  const failed = catalog.state.kind === "failed";
  const statusText = demoSearchStatus({ failed, offline, query, results });
  const label = exerciseName.trim() || "this exercise";
  const showLinked = link !== undefined && !changing;
  // The search takes focus as it mounts (autoFocus); Change once the linked demo shows.
  useEffect(() => {
    if (focus === "change" && showLinked) {
      if (Platform.OS === "web") changeButton.current?.focus();
      onPick("focused");
    } else if (focus === "search" && !showLinked && !failed) onPick("focused");
  }, [focus, showLinked, failed, onPick]);
  return (
    <View testID="kinevault-demo" style={{ gap: spacing.layout }}>
      <SectionLabel>KineVault demo</SectionLabel>
      {showLinked ? (
        <>
          <ExerciseDemo key={link.id} link={link} label={label} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="link" size={15} color={colors.mutedForeground} />
            <AppText variant="caption" muted style={{ flex: 1 }}>
              {`Linked to ${linked?.name ?? "a KineVault exercise"}`}
            </AppText>
          </View>
          <ButtonRow>
            <AppButton
              ref={changeButton}
              icon="rotate"
              label="Change"
              accessibilityLabel="Change KineVault demo"
              fill
              disabled={disabled}
              onPress={() => onPick("change")}
            />
            <AppButton
              icon="xmark"
              label="Unlink"
              accessibilityLabel="Unlink KineVault demo"
              fill
              disabled={disabled}
              onPress={onUnlink}
            />
          </ButtonRow>
        </>
      ) : (
        <>
          {!failed && (
            <TextField
              labelTone="muted"
              label="Find in KineVault"
              value={query}
              onChange={(value) => onPick({ query: value })}
              disabled={disabled || catalog.state.kind === "loading"}
              autoFocus={focus === "search"}
            />
          )}
          <StatusLine text={statusText} />
          {failed ? (
            <RetryButton
              label="Retry"
              accessibilityLabel="Retry loading KineVault demos"
              onRetry={catalog.retry}
            />
          ) : (
            results.map((entry) => (
              <DemoResult
                key={entry.id}
                entry={entry}
                disabled={disabled}
                onPress={() => onLink(entry)}
              />
            ))
          )}
        </>
      )}
      {link !== undefined && changing && (
        <AppButton
          icon="chevron-left"
          label="Keep current demo"
          disabled={disabled}
          onPress={() => onPick("keep")}
        />
      )}
    </View>
  );
}
