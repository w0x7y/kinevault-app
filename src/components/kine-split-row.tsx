import { useState, type ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import { Kine, type KinePose } from "../onboarding/kine";
import { spacing } from "../theme/tokens";

export function KineSplitRow({
  pose,
  testIDPrefix,
  rowTestID,
  children,
}: {
  pose: KinePose;
  testIDPrefix: string;
  rowTestID?: string;
  children: ReactNode | ((columnWidth: number) => ReactNode);
}) {
  const { width } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const availableWidth = rowWidth || Math.max(0, Math.min(width, 768) - spacing.layout * 2);
  const gap = spacing.layout;
  const columnWidth = Math.max(0, (availableWidth - gap) / 2);
  return (
    <View
      testID={rowTestID ?? `${testIDPrefix}-kine-row`}
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: "row", alignItems: "stretch", gap }}
    >
      <View testID={`${testIDPrefix}-kine-content`} style={{ flex: 1, minWidth: 0 }}>
        {typeof children === "function" ? children(columnWidth) : children}
      </View>
      <View
        testID={`${testIDPrefix}-kine-column`}
        style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" }}
      >
        <Kine pose={pose} size={columnWidth} />
      </View>
    </View>
  );
}
