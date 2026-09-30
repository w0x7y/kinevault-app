import { Compass } from "lucide-react-native";
import { Destination, Screen } from "../components/ui";

export default function NotFoundScreen() {
  return (
    <Screen title="Page not found" description="This page isn't available.">
      <Destination href="/" title="Back to Today" icon={Compass} />
    </Screen>
  );
}
