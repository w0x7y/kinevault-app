import { useEvent } from "expo";
import { Image } from "expo-image";
import { useIsFocused } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { AppButton } from "../../components/button";
import { Icon } from "../../components/icon";
import { AppText } from "../../components/ui";
import { useConnectivity } from "../../connectivity/provider";
import { useTheme } from "../../theme/provider";
import { radius, spacing } from "../../theme/tokens";
import type { CatalogLink, ExerciseDefinition } from "../model";
import { useExercises } from "../provider";
import { demoCatalogConfig, demoObjectUrl } from "./config";
import { demoStatus, resolveDemoLink } from "./demo-link";
import { useDemoCatalog } from "./provider";
import { RetryButton } from "./retry-button";
import { StatusLine } from "./status-line";

function Frame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 4 / 3,
        borderRadius: radius.panel,
        overflow: "hidden",
        backgroundColor: colors.muted,
      }}
    >
      {children}
    </View>
  );
}

function DemoVideo({ uri, label, onError }: { uri: string; label: string; onError: () => void }) {
  // Clips are cached on iOS and Android after the first view; the web build
  // relies on the browser's HTTP cache.
  const player = useVideoPlayer({ uri, useCaching: Platform.OS !== "web" }, (created) => {
    created.loop = true;
    created.muted = true;
    created.play();
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEffect(() => {
    if (status === "error") onError();
  }, [status, onError]);
  return (
    <VideoView
      testID="exercise-demo-video"
      player={player}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      accessibilityLabel={`Demonstration of ${label}`}
      style={{ flex: 1 }}
    />
  );
}

/** A KineVault demonstration: the poster first, then a muted loop after a tap. */
export function ExerciseDemo({ link, label }: { link: CatalogLink; label: string }) {
  const { colors } = useTheme();
  const catalog = useDemoCatalog();
  const offline = useConnectivity() === "offline";
  const [playing, setPlaying] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fail = useCallback(() => setMediaFailed(true), []);
  const focused = useIsFocused();
  // Tab screens stay mounted when blurred, so leaving the screen returns to the poster.
  useEffect(() => {
    if (!focused) setPlaying(false);
  }, [focused]);
  const config = demoCatalogConfig;
  const status = config ? demoStatus({ state: catalog.state, link, mediaFailed, offline }) : null;
  const ready = status?.kind === "ready" ? status : null;
  // One container and one status line stay mounted whatever the state, so
  // screen readers announce the status text as it changes.
  let notice: { text: string; onRetry?: () => void | Promise<void> } | null = null;
  if (!status || status.kind === "unavailable") notice = { text: "Demonstration unavailable." };
  else if (status.kind === "loading") notice = { text: "Loading demonstration." };
  else if (status.kind === "connect")
    notice = { text: "Connect to load this demonstration.", onRetry: catalog.retry };
  else if (status.kind === "catalog-unavailable")
    notice = {
      text: "KineVault demos aren't available right now. Try again later.",
      onRetry: catalog.retry,
    };
  else if (status.kind === "failed")
    notice = {
      text: status.offline
        ? "Connect to load this demonstration."
        : "Couldn't load this demonstration. Check your connection and try again.",
      onRetry: () => {
        setMediaFailed(false);
        setPlaying(false);
        setAttempt((value) => value + 1);
      },
    };
  return (
    <View
      testID={ready ? "exercise-demo" : "exercise-demo-message"}
      style={
        ready
          ? { gap: spacing.xs }
          : {
              borderRadius: radius.panel,
              backgroundColor: colors.muted,
              padding: spacing.layout,
              gap: spacing.sm,
            }
      }
    >
      <StatusLine text={notice?.text ?? ""} />
      {notice?.onRetry && (
        <RetryButton
          accessibilityLabel="Retry loading the demonstration"
          onRetry={notice.onRetry}
        />
      )}
      {config && ready && (
        <>
          <Frame>
            {playing ? (
              <DemoVideo
                key={`video-${attempt}`}
                uri={demoObjectUrl(config, ready.videoPath)}
                label={label}
                onError={fail}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play demonstration of ${label}`}
                onPress={() => setPlaying(true)}
                style={{ flex: 1 }}
              >
                <Image
                  key={`poster-${attempt}`}
                  source={{ uri: demoObjectUrl(config, ready.posterPath) }}
                  cachePolicy="memory-disk"
                  contentFit="contain"
                  transition={0}
                  accessible={false}
                  onError={fail}
                  style={{ flex: 1 }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="play" size={18} color={colors.primaryForeground} />
                  </View>
                </View>
              </Pressable>
            )}
          </Frame>
          <AppText variant="caption" muted>
            {ready.entry.credit}
          </AppText>
        </>
      )}
    </View>
  );
}

/** A small 4:3 poster for search results; nothing when no published demo exists. */
export function DemoThumbnail({ link }: { link: CatalogLink }) {
  const { colors } = useTheme();
  const { state } = useDemoCatalog();
  const config = demoCatalogConfig;
  const entry = state.kind === "ready" ? state.byId.get(link.id) : undefined;
  if (!config || entry?.status !== "published" || !entry.posterPath) return null;
  return (
    <Image
      testID="exercise-demo-thumbnail"
      source={{ uri: demoObjectUrl(config, entry.posterPath) }}
      cachePolicy="memory-disk"
      contentFit="contain"
      transition={0}
      accessible={false}
      style={{ width: 64, height: 48, borderRadius: radius.control, backgroundColor: colors.muted }}
    />
  );
}

/**
 * The demo area of a workout or template exercise. Unlinked exercises show
 * "Link demo" only when the caller supports leaving for the exercise form and
 * the library definition still exists.
 */
export function ExerciseDemoSlot({
  exercise,
  label,
  disabled = false,
  onLinkDemo,
}: {
  exercise: ExerciseDefinition;
  label: string;
  disabled?: boolean;
  onLinkDemo?: (definition: ExerciseDefinition) => void;
}) {
  const store = useExercises();
  const library = store.state.kind === "ready" ? store.state.document.exercises : [];
  const link = resolveDemoLink(library, exercise);
  if (link) return <ExerciseDemo key={link.id} link={link} label={label} />;
  const definition = library.find((item) => item.id === exercise.id);
  if (!onLinkDemo || !definition) return null;
  return (
    <AppButton
      label="Link demo"
      accessibilityLabel={`Link a KineVault demo to ${label}`}
      accessibilityHint="Opens this exercise's form at its KineVault search"
      disabled={disabled}
      onPress={() => onLinkDemo(definition)}
    />
  );
}
