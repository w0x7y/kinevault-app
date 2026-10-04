import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View, type ImageStyle, type StyleProp } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { useProfileMedia } from "./media-provider";
import type { StoredPhoto } from "./media-model";

type Resolution = { key: string; kind: "loading" | "unavailable" } | { key: string; kind: "ready"; uri: string };

export function PhotoImage({ image, thumbnail = false, accessibilityLabel, style, contentFit = "cover" }: {
  image: StoredPhoto;
  thumbnail?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain";
}) {
  const { files } = useProfileMedia();
  const { colors } = useTheme();
  const key = `${image.id}:${thumbnail}`;
  const [resolution, setResolution] = useState<Resolution>({ key, kind: "loading" });
  useEffect(() => {
    let canceled = false;
    let uri: string | undefined;
    setResolution({ key, kind: "loading" });
    files.resolvePhoto({ id: image.id, width: image.width, height: image.height }, thumbnail).then(
      resolved => {
        if (canceled) { files.releaseUri(resolved); return; }
        uri = resolved;
        setResolution({ key, kind: "ready", uri: resolved });
      },
      () => { if (!canceled) setResolution({ key, kind: "unavailable" }); },
    );
    return () => {
      canceled = true;
      if (uri) files.releaseUri(uri);
    };
  }, [files, key, image.id, image.width, image.height, thumbnail]);

  if (resolution.key === key && resolution.kind === "ready") {
    return <Image source={{ uri: resolution.uri }} style={style} contentFit={contentFit}
      accessibilityLabel={accessibilityLabel} recyclingKey={key}
      onError={() => {
        files.releaseUri(resolution.uri);
        setResolution(current => current.key === key ? { key, kind: "unavailable" } : current);
      }} />;
  }
  const unavailable = resolution.key === key && resolution.kind === "unavailable";
  return <View accessible accessibilityRole="image"
    accessibilityLabel={`${accessibilityLabel}. ${unavailable ? "Photo unavailable" : "Loading photo"}.`}
    style={[style, { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", padding: 8 }]}>
    <AppText variant="caption" muted style={{ textAlign: "center" }}>
      {unavailable ? "Photo unavailable" : "Loading photo…"}
    </AppText>
  </View>;
}
