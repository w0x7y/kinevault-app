import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
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
        borderWidth: 1,
        borderRadius: radius.control,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.accent : colors.background,
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
  useEffect(() => {
    void refreshIfStale();
  }, [refreshIfStale]);
  const entries = catalog.state.kind === "ready" ? catalog.state.entries : null;
  const search = useMemo(() => createDemoCatalogSearch(entries ?? []), [entries]);
  const results = query.trim() ? search(query) : [];
  const linked =
    link && catalog.state.kind === "ready" ? catalog.state.byId.get(link.id) : undefined;
  const label = exerciseName.trim() || "this exercise";
  const showLinked = link !== undefined && !changing;
  return (
    <View testID="kinevault-demo" style={{ gap: spacing.layout }}>
      <AppText variant="label">KineVault demo</AppText>
      {showLinked ? (
        <>
          <ExerciseDemo key={link.id} link={link} label={label} />
          <AppText variant="caption" muted>
            {`Linked to ${linked?.name ?? link.slug}`}
          </AppText>
          <ButtonRow>
            <AppButton
              label="Change"
              accessibilityLabel="Change KineVault demo"
              fill
              disabled={disabled}
              onPress={() => setChanging(true)}
            />
            <AppButton
              label="Unlink"
              accessibilityLabel="Unlink KineVault demo"
              fill
              disabled={disabled}
              onPress={onUnlink}
            />
          </ButtonRow>
        </>
      ) : catalog.state.kind === "failed" ? (
        <>
          <AppText variant="caption" muted accessibilityLiveRegion="polite">
            {offline
              ? "Connect to search KineVault demos."
              : "KineVault demos aren't available right now. Try again later."}
          </AppText>
          <AppButton
            label="Retry"
            accessibilityLabel="Retry loading KineVault demos"
            onPress={() => void catalog.retry()}
          />
        </>
      ) : (
        <>
          <ExerciseField
            label="Find in KineVault"
            value={query}
            onChange={setQuery}
            disabled={disabled || catalog.state.kind === "loading"}
            autoFocus={focusSearch}
          />
          {query.trim() !== "" && (
            <AppText variant="caption" muted accessibilityLiveRegion="polite">
              {results.length
                ? `${results.length} KineVault ${results.length === 1 ? "exercise" : "exercises"} found.`
                : "No KineVault exercises found. Try another name."}
            </AppText>
          )}
          {results.map((entry) => (
            <DemoResult
              key={entry.id}
              entry={entry}
              disabled={disabled}
              onPress={() => {
                onLink(entry);
                setChanging(false);
                setQuery("");
              }}
            />
          ))}
        </>
      )}
      {link !== undefined && changing && (
        <AppButton
          label="Keep current demo"
          disabled={disabled}
          onPress={() => setChanging(false)}
        />
      )}
    </View>
  );
}
