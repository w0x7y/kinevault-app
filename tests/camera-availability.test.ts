import assert from "node:assert/strict";
import test from "node:test";
import { checkFoodCameraAvailability } from "../src/food/camera-availability.ts";

test("iOS and Android can mount after permission even when the web-only camera capability is absent", async () => {
  for (const platform of ["ios", "android"]) {
    let probes = 0;
    // Installed CameraView.isAvailableAsync rejects when the native manager lacks it.
    const available = await checkFoodCameraAvailability({
      platform,
      isWebAvailable: async () => {
        probes++;
        throw new Error("expo-camera.isAvailableAsync is unavailable on this platform");
      },
    });
    assert.equal(available, true, platform);
    assert.equal(probes, 0, platform);
  }
});

test("web honors camera presence and propagates capability failures for the manual fallback", async () => {
  for (const available of [true, false]) {
    let probes = 0;
    assert.equal(
      await checkFoodCameraAvailability({
        platform: "web",
        isWebAvailable: async () => {
          probes++;
          return available;
        },
      }),
      available,
    );
    assert.equal(probes, 1);
  }
  await assert.rejects(
    checkFoodCameraAvailability({
      platform: "web",
      isWebAvailable: async () => {
        throw new Error("Camera enumeration failed");
      },
    }),
    /Camera enumeration failed/,
  );
});
