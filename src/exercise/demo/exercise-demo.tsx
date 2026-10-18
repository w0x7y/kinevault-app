import { useEvent } from "expo";
import { Image } from "expo-image";
import { useIsFocused } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useReducer, type ReactNode } from "react";
import { Platform, View } from "react-native";
import { AppButton } from "../../components/button";
import { Icon } from "../../components/icon";
import { Tappable } from "../../components/tappable";
import { AppText } from "../../components/ui";
import { useConnectivity } from "../../connectivity/provider";
import { useTheme } from "../../theme/provider";
import { darkColors, radius, spacing } from "../../theme/tokens";
import type { CatalogLink, ExerciseDefinition } from "../model";
import { useExercises } from "../provider";
import { demoBackdrop, demoCatalogConfig, demoObjectUrl } from "./config";
import {
  demoNotice,
  demoPlayback,
  demoStatus,
  initialDemoPlayback,
  resolveDemoLink,
} from "./demo-link";
import { useDemoCatalog } from "./provider";
import { RetryButton } from "../../components/load-failure";
import { StatusLine } from "./status-line";

function Frame({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 4 / 3,
        // Capped so a demo never pushes the workout's actions far below the fold.
        maxHeight: 260,
        borderRadius: radius.control,
        overflow: "hidden",
        backgroundColor: demoBackdrop,
      }}
    >
      {children}
    </View>
  );
}

/** How long a tapped clip may take to become ready before it counts as failed. */
const clipStartTimeoutMs = 20_000;

function DemoVideo({
  uri,
  label,
  onError,
  onStarted,
  onTimedOut,
}: {
  uri: string;
  label: string;
  onError: () => void;
  onStarted: () => void;
  onTimedOut: () => void;
}) {
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
  // A request that never answers raises no error, so report a clip that hasn't reached
  // readyToPlay in time. demoPlayback ignores the timeout once the clip has started.
  useEffect(() => {
    if (player.status === "readyToPlay") {
      onStarted();
      return;
    }
    const timer = setTimeout(onTimedOut, clipStartTimeoutMs);
    const subscription = player.addListener("statusChange", ({ status: next }) => {
      if (next === "readyToPlay") onStarted();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [player, onStarted, onTimedOut]);
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
  const [playback, dispatch] = useReducer(demoPlayback, initialDemoPlayback);
  const fail = useCallback(() => dispatch("failed"), []);
  const started = useCallback(() => dispatch("started"), []);
  const timedOut = useCallback(() => dispatch("timed-out"), []);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) dispatch("blurred");
  }, [focused]);
  const config = demoCatalogConfig;
  const status = config
    ? demoStatus({ state: catalog.state, link, mediaFailed: playback.failed, offline })
    : null;
  const ready = status?.kind === "ready" ? status : null;
  // One container and one status line stay mounted whatever the state, so
  // screen readers announce the status text as it changes.
  const notice = demoNotice(status);
  const onRetry =
    notice?.retry === "catalog"
      ? catalog.retry
      : notice?.retry === "media"
        ? () => dispatch("retry")
        : undefined;
  return (
    <View
      testID={ready ? "exercise-demo" : "exercise-demo-message"}
      style={
        ready
          ? { gap: spacing.xs }
          : {
              borderRadius: radius.control,
              backgroundColor: colors.muted,
              padding: spacing.layout,
              gap: spacing.sm,
            }
      }
    >
      <StatusLine text={notice?.text ?? ""} />
      {onRetry && (
        <RetryButton
          label="Retry"
          accessibilityLabel="Retry loading the demonstration"
          onRetry={onRetry}
        />
      )}
      {config && ready && (
        <>
          <Frame>
            {playback.phase !== "poster" ? (
              <DemoVideo
                key={`video-${playback.attempt}`}
                uri={demoObjectUrl(config, ready.videoPath)}
                label={label}
                onError={fail}
                onStarted={started}
                onTimedOut={timedOut}
              />
            ) : (
              // The poster itself is the control; it doesn't shrink inside its frame.
              <Tappable
                label={`Play demonstration of ${label}`}
                onPress={() => dispatch("play")}
                feedback="none"
                style={{ flex: 1, borderRadius: radius.control }}
              >
                <Image
                  key={`poster-${playback.attempt}`}
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
                  {/* Dark-theme colors in both themes, to stand out on the dark backdrop. */}
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      paddingLeft: 3,
                      backgroundColor: darkColors.primary,
                      boxShadow: "0px 6px 18px rgba(0, 0, 0, 0.18)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="play" size={22} color={darkColors.primaryForeground} />
                  </View>
                </View>
              </Tappable>
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
      style={{ width: 64, height: 48, borderRadius: radius.tile, backgroundColor: demoBackdrop }}
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
      icon="link"
      label="Link demo"
      accessibilityLabel={`Link a KineVault demo to ${label}`}
      accessibilityHint="Opens this exercise's form at its KineVault search"
      disabled={disabled}
      onPress={() => onLinkDemo(definition)}
    />
  );
}
