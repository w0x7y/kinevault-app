import * as Sharing from "expo-sharing";
import { PixelRatio, Platform, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

/** The shared image's size in pixels. */
const size = { width: 1080, height: 1350 };

/**
 * Captures `view` as a 1080 × 1350 PNG and opens the share sheet with it. Null on web,
 * where view-shot needs an extra library, so the Share action hides there.
 */
export const shareImage:
  ((view: View | null, dialogTitle: string) => Promise<void>) | null = async (
  view,
  dialogTitle,
) => {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable.");
  // iOS sizes a capture in points, Android in pixels.
  const scale = Platform.OS === "ios" ? PixelRatio.get() : 1;
  const uri = await captureRef(view, {
    format: "png",
    result: "tmpfile",
    width: size.width / scale,
    height: size.height / scale,
  });
  // The file stays in the cache: the app it went to may still read it after the sheet closes.
  await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle });
};
