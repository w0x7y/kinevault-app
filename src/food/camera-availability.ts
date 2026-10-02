// Expo's availability probe is web-only. Native devices rely on permission and
// CameraView mount errors, so a missing web method cannot block their preview.
export async function checkFoodCameraAvailability({ platform, isWebAvailable }: {
  platform: string; isWebAvailable: () => Promise<boolean>;
}): Promise<boolean> {
  if (platform !== "web") return true;
  return isWebAvailable();
}
