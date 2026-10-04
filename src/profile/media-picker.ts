import * as ImagePicker from "expo-image-picker";
import { validatePhotoSource, type PhotoSource } from "./media-model";

export async function pickProfilePhoto(source: "library" | "camera", avatar: boolean): Promise<PhotoSource | null> {
  const web = process.env.EXPO_OS === "web";
  if (web && (typeof window === "undefined" || source === "camera")) return null;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    allowsEditing: avatar && !web,
    ...(avatar && !web ? { aspect: [1, 1] } : {}),
    quality: 1,
    base64: web,
  };
  // Library selection uses the system photo picker and needs no broad library grant.
  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  try {
    // Expo creates a blob URL on web. Return a draft-safe data URI so the caller
    // can retain a failed edit without needing a separate URL ownership contract.
    if (web && !asset.base64) throw new Error("This photo could not be read");
    const selected: PhotoSource = {
      uri: web ? `data:${asset.mimeType ?? asset.file?.type ?? "image/jpeg"};base64,${asset.base64}` : asset.uri,
      width: asset.width,
      height: asset.height,
      ...(asset.file ? { file: asset.file } : {}),
    };
    validatePhotoSource(selected);
    return selected;
  } finally {
    if (web && asset.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
  }
}
