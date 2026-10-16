import type { ReactNode } from "react";
import { View } from "react-native";
import { AppText, Overline } from "./ui";
import { spacing } from "../theme/tokens";

/** The top of a sub-view's content: an optional overline, the serif title and what follows it. */
export function ViewHeader({
  overline,
  title,
  selectable = false,
  children,
}: {
  overline?: string;
  title: string;
  /** Lets the overline and title be copied, e.g. a food's name. */
  selectable?: boolean;
  /** Supporting content under the title. */
  children?: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ gap: 2, minWidth: 0 }}>
        {overline ? <Overline selectable={selectable}>{overline}</Overline> : null}
        <AppText
          variant="title"
          accessibilityRole="header"
          selectable={selectable}
          style={{ flexShrink: 1 }}
        >
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}
