import { Linking } from "react-native";
import { AppText } from "../components/ui";
import { Icon } from "../components/icon";
import { Tappable } from "../components/tappable";
import { fonts, radius, spacing } from "../theme/tokens";
import { useTheme } from "../theme/provider";
import { productSourceURL } from "./import-metadata.ts";

export function ProductAttribution({ barcode }: { barcode?: string }) {
  const { colors } = useTheme();
  const url = barcode ? productSourceURL(barcode) : "https://world.openfoodfacts.org";
  return (
    <Tappable
      role="link"
      label="Data from Open Food Facts"
      onPress={() => {
        void Linking.openURL(url).catch(() => {});
      }}
      feedback="fill"
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: spacing.sm,
        marginHorizontal: -spacing.sm,
        borderRadius: radius.control,
      }}
    >
      <Icon name="link" size={14} color={colors.brand} />
      <AppText variant="caption" style={{ color: colors.brand, fontFamily: fonts.semibold }}>
        Data from Open Food Facts
      </AppText>
    </Tappable>
  );
}
