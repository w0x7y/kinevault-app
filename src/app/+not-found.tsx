import { router } from "expo-router";
import { AppButton } from "../components/button";
import { StatusScreen } from "../onboarding/status-screen";

export default function NotFoundScreen() {
  return (
    <StatusScreen
      icon="compass"
      title="Page not found"
      documentTitle="Page not found"
      message="This page isn't available. It may have moved, or the link is incomplete."
    >
      <AppButton
        label="Back to Home"
        tone="primary"
        icon="house"
        onPress={() => router.replace("/")}
      />
    </StatusScreen>
  );
}
