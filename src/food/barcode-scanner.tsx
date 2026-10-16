import { AppButton } from "../components/button";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { Icon } from "../components/icon";
import { Section } from "./food-ui";
import { TextField } from "../components/text-field";
import { normalizeProductBarcode, supportedProductBarcodeTypes } from "./barcode.ts";
import { checkFoodCameraAvailability } from "./camera-availability.ts";

// Mounted only after the user opens Scan. A successful detection immediately locks
// this instance; the parent unmounts it before starting the product lookup.
export function FoodBarcodeScanner({
  onBarcode,
  onClose,
}: {
  onBarcode: (barcode: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== "background");
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  const permissionPending = useRef(true);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    let active = true;
    void checkFoodCameraAvailability({
      platform: Platform.OS,
      isWebAvailable: () => CameraView.isAvailableAsync(),
    })
      .then((value) => {
        if (active) setAvailable(value);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    permissionPending.current = true;
    void requestPermission()
      .catch(() => {
        if (active) setCameraError(true);
      })
      .finally(() => {
        permissionPending.current = false;
      });
    const listener = AppState.addEventListener("change", (state) => {
      // Permission dialogs can background the app. Retain the scanner during
      // permission requests, but always release its camera until an active event.
      if (state === "active" || state === "background") setForeground(state === "active");
      if (state === "background" && !permissionPending.current) closeRef.current();
    });
    return () => {
      active = false;
      locked.current = true;
      listener.remove();
    };
  }, [requestPermission]);
  function detect(data: string, format?: string) {
    if (locked.current) return;
    const normalized = normalizeProductBarcode(data, format);
    if (!normalized) {
      setError("Enter a valid EAN or UPC product barcode. QR codes aren't supported.");
      return;
    }
    locked.current = true;
    onBarcode(normalized);
  }
  const unavailable = cameraError || available === false;
  const live = foreground && permission?.granted && available && !cameraError;
  return (
    <View testID="food-barcode-scanner" style={{ gap: spacing.layout }}>
      <AppText variant="caption" muted style={{ paddingHorizontal: spacing.xs }}>
        Point the camera at an EAN or UPC barcode, or enter the printed numbers below.
      </AppText>
      <Section>
        <View
          style={{
            height: 220,
            borderRadius: radius.control,
            overflow: "hidden",
            backgroundColor: live ? "#000" : colors.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {live ? (
            <CameraView
              testID="food-barcode-camera"
              facing="back"
              mode="picture"
              style={{ height: "100%", width: "100%" }}
              barcodeScannerSettings={{ barcodeTypes: [...supportedProductBarcodeTypes] }}
              onMountError={() => setCameraError(true)}
              onBarcodeScanned={({ data, type }) => detect(data, type)}
            />
          ) : (
            <View style={{ alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              <Icon name="barcode" size={34} color={colors.mutedForeground} />
              <AppText variant="caption" muted style={{ textAlign: "center" }}>
                {unavailable
                  ? "Camera unavailable. You can enter the barcode manually."
                  : permission && !permission.granted
                    ? "Camera permission is needed to scan. You can enter the barcode manually."
                    : "Opening camera..."}
              </AppText>
              {permission && !permission.granted && !unavailable && (
                <AppButton
                  icon="camera"
                  label={permission.canAskAgain ? "Allow camera" : "Open camera settings"}
                  onPress={() => {
                    if (!permission.canAskAgain) {
                      void Linking.openSettings().catch(() => setCameraError(true));
                      return;
                    }
                    permissionPending.current = true;
                    void requestPermission()
                      .catch(() => setCameraError(true))
                      .finally(() => {
                        permissionPending.current = false;
                      });
                  }}
                />
              )}
            </View>
          )}
          {live && (
            // A quiet frame marks where the barcode should sit.
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frameWrap]}>
              <View style={styles.frame} />
            </View>
          )}
        </View>
      </Section>
      <Section title="Enter manually">
        <TextField
          label="Product barcode"
          value={barcode}
          onChange={(value) => {
            setBarcode(value);
            setError(undefined);
          }}
          error={error}
          kind="decimal"
        />
        <AppButton label="Look up barcode" tone="primary" onPress={() => detect(barcode)} />
        <AppText variant="caption" muted style={{ textAlign: "center" }}>
          Scanning opens a draft. Review and save it to keep it in your foods.
        </AppText>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  frameWrap: { alignItems: "center", justifyContent: "center" },
  frame: {
    width: "72%",
    height: 110,
    borderRadius: radius.tile,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
});
