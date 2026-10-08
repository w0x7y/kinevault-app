import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { FoodButton } from "./food-button";
import { FoodField } from "./form-fields";
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
  return (
    <View testID="food-barcode-scanner" style={{ gap: spacing.layout }}>
      <AppText variant="heading" accessibilityRole="header">
        Scan food barcode
      </AppText>
      <AppText muted>
        Point the camera at an EAN or UPC barcode, or enter the printed numbers below.
      </AppText>
      {foreground && permission?.granted && available && !cameraError ? (
        <CameraView
          testID="food-barcode-camera"
          facing="back"
          mode="picture"
          style={{ height: 240, width: "100%" }}
          barcodeScannerSettings={{ barcodeTypes: [...supportedProductBarcodeTypes] }}
          onMountError={() => setCameraError(true)}
          onBarcodeScanned={({ data, type }) => detect(data, type)}
        />
      ) : (
        <AppText variant="caption" muted>
          {cameraError || available === false
            ? "Camera unavailable. You can enter the barcode manually."
            : permission && !permission.granted
              ? "Camera permission is needed to scan. You can enter the barcode manually."
              : "Opening camera..."}
        </AppText>
      )}
      {permission && !permission.granted && (
        <FoodButton
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
      <FoodField
        label="Product barcode"
        value={barcode}
        onChange={(value) => {
          setBarcode(value);
          setError(undefined);
        }}
        error={error}
        disabled={false}
        numeric
      />
      <FoodButton label="Look up barcode" primary onPress={() => detect(barcode)} />
      <FoodButton label="Cancel scan" onPress={onClose} />
      <AppText variant="caption" style={{ color: colors.mutedForeground }}>
        Scanning opens a draft. Review and save it to keep it in your foods.
      </AppText>
    </View>
  );
}
