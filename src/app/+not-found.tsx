import { Compass } from "lucide-react-native";
import { Destination, EmptyState, Screen } from "../components/ui";

export default function NotFoundScreen() {
  return (
    <Screen
      title="Page not found"
      description="This destination is not available."
    >
      <EmptyState
        icon={Compass}
        title="Let's get you back"
        description="Use Today to return to the app."
      />
      <Destination
        href="/"
        title="Go to Today"
        description="Return to KineVault Track."
        icon={Compass}
      />
    </Screen>
  );
}
