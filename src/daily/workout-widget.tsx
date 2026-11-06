import { View } from "react-native";
import { AppButton } from "../components/button";
import { LoadFailure } from "../components/load-failure";
import { AppText, Overline, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { DayActivity } from "./activity";
import { WorkoutShare } from "./workout-share";
import { Tappable } from "../components/tappable";
import { PlusTag } from "../plus/locks";
import { usePaywall } from "../plus/paywall";

/** A day's distance total without Plus: the Plus tag in its place, which opens the paywall. */
function PlusStat() {
  const paywall = usePaywall();
  return (
    <>
      <Tappable
        label="Distance total, part of Plus"
        onPress={() => paywall.open("distance")}
        feedback="fill"
        style={{ alignSelf: "flex-start", justifyContent: "center", borderRadius: radius.pill }}
      >
        <PlusTag />
      </Tappable>
      {paywall.sheet}
    </>
  );
}

/** "WORKOUT" with a small status chip on the right. */
function WidgetTop({ status }: { status?: "Live" | "Done" }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 26,
        gap: spacing.sm,
      }}
    >
      <Overline>Workout</Overline>
      {status && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.muted,
          }}
        >
          {status === "Done" && <Icon name="check" size={13} color={colors.primary} />}
          <AppText variant="caption" style={{ fontFamily: fonts.bold, fontSize: 12 }}>
            {status}
          </AppText>
        </View>
      )}
    </View>
  );
}

/** Draws the Workout tile Daily activity worked out. */
export function WorkoutWidget({
  tile,
  detailed = false,
  onAddWorkout,
}: {
  tile: DayActivity["workout"];
  detailed?: boolean;
  onAddWorkout?: () => void;
}) {
  const { colors } = useTheme();
  const testID = detailed ? "exercise-workout" : "home-workout";
  if (tile.kind === "loading" || tile.kind === "error")
    return (
      <Panel testID={testID}>
        <WidgetTop />
        {tile.kind === "loading" ? (
          <AppText variant="label" muted>
            Loading your workouts...
          </AppText>
        ) : (
          <LoadFailure
            message="Couldn't load your workouts."
            retryLabel="Retry workouts"
            onRetry={tile.retry}
          />
        )}
      </Panel>
    );
  if (tile.kind === "empty")
    return (
      <Panel testID={detailed ? "exercise-workout-empty" : "home-workout-empty"}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconWell icon="dumbbell" color={colors.primary} size="large" />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Overline>Workout</Overline>
            <AppText variant="label" muted>
              {tile.message}
            </AppText>
          </View>
        </View>
        <AppButton
          label="Add workout"
          icon="plus"
          accessibilityHint="Opens the saved workout menu"
          disabled={!onAddWorkout}
          onPress={() => onAddWorkout?.()}
        />
      </Panel>
    );
  // A workout under way with nothing completed yet: its totals arrive when it ends.
  if (tile.kind === "live")
    return (
      <Panel testID={testID} style={{ gap: spacing.sm }}>
        <WidgetTop status="Live" />
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}
        >
          {tile.name}
        </AppText>
        <AppText variant="caption" muted>
          Workout in progress. Totals appear here when you end it.
        </AppText>
      </Panel>
    );
  return (
    <Panel testID={testID} style={{ gap: spacing.layout }}>
      <View style={{ gap: spacing.xs }}>
        <WidgetTop status={tile.status} />
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}
        >
          {tile.name}
        </AppText>
      </View>
      <View style={{ gap: 0 }}>
        <AppText variant="caption" muted>
          Total lifted
        </AppText>
        <AppText selectable variant="hero" style={{ fontSize: 38, lineHeight: 44 }}>
          {tile.lifted}
          <AppText
            variant="heading"
            muted
            style={{ fontFamily: fonts.bold, fontSize: 18, letterSpacing: 0 }}
          >
            {` ${tile.liftedUnit}`}
          </AppText>
        </AppText>
        {detailed && (
          <AppText variant="caption" muted>
            {tile.detail}
          </AppText>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderColor: colors.border,
        }}
      >
        {tile.stats.map(({ label, value, plus }, index) => (
          <View
            key={label}
            style={{
              flex: 1,
              minWidth: 0,
              gap: 2,
              paddingLeft: index ? spacing.md : 0,
              borderLeftWidth: index ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <AppText variant="caption" muted>
              {label}
            </AppText>
            {plus ? (
              <PlusStat />
            ) : (
              <AppText
                selectable
                variant="label"
                style={{
                  fontFamily: fonts.extrabold,
                  fontSize: 17,
                  lineHeight: 23,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {value}
              </AppText>
            )}
          </View>
        ))}
      </View>
      {detailed && tile.exercises.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <Overline style={{ marginTop: spacing.xs }}>Exercises</Overline>
          {tile.exercises.map((exercise, index) => (
            <View
              key={exercise.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderTopWidth: index ? 1 : 0,
                borderColor: colors.border,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <AppText variant="label" style={{ fontSize: 15, lineHeight: 21 }}>
                  {exercise.name}
                </AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6 }}>
                  {exercise.counts.map((count, position) => (
                    <View key={position} style={{ flexDirection: "row", columnGap: 6 }}>
                      {position > 0 && (
                        <AppText variant="caption" muted aria-hidden>
                          ·
                        </AppText>
                      )}
                      <AppText
                        variant="caption"
                        muted
                        accessibilityLabel={`${exercise.name}, ${count}`}
                      >
                        {count}
                      </AppText>
                    </View>
                  ))}
                </View>
                {exercise.record && (
                  // Wraps between its parts, like the counts above it.
                  <View
                    accessible
                    accessibilityLabel={`${exercise.name}, ${exercise.record.label}`}
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      columnGap: 5,
                      marginTop: 2,
                    }}
                  >
                    <Icon name="trophy" size={14} color={colors.success} />
                    {exercise.record.parts.map((part, position) => (
                      <AppText
                        key={position}
                        variant="caption"
                        style={{ color: colors.success, fontFamily: fonts.bold }}
                      >
                        {position > 0 ? `· ${part}` : part}
                      </AppText>
                    ))}
                  </View>
                )}
              </View>
              <AppText
                variant="label"
                accessibilityLabel={`${exercise.name}, ${exercise.amountLabel}`}
                style={{ fontFamily: fonts.bold, fontVariant: ["tabular-nums"] }}
              >
                {exercise.amount}
              </AppText>
            </View>
          ))}
        </View>
      )}
      {detailed && <WorkoutShare share={tile.share} />}
    </Panel>
  );
}
