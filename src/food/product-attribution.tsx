import { Linking, Pressable } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { productSourceURL } from "./import-metadata.ts";

export function ProductAttribution({ barcode }: { barcode?: string }) {
  const { colors } = useTheme();
  const url = barcode ? productSourceURL(barcode) : "https://world.openfoodfacts.org";
  return <Pressable accessibilityRole="link" accessibilityLabel="Data from Open Food Facts"
    onPress={() => { void Linking.openURL(url).catch(() => {}); }} style={{ minHeight: 44, justifyContent: "center" }}>
    <AppText variant="caption" style={{ color: colors.primary, textDecorationLine: "underline" }}>Data from Open Food Facts</AppText>
  </Pressable>;
}
