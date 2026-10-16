import { LoadFailure } from "../components/load-failure";
import { useCustomFoods } from "./custom-provider";
import { KineLoading } from "../components/kine-loading";

export function CustomFoodStatus() {
  const foods = useCustomFoods();
  if (foods.state.kind === "ready") return null;
  if (foods.state.kind === "loading")
    return <KineLoading compact label="Loading your custom foods..." />;
  return (
    <LoadFailure
      appearance="panel"
      message="Couldn't load your custom foods"
      description="Retry to access saved foods and meals and create new ones. You can still search the USDA database."
      retryLabel="Retry custom foods"
      onRetry={foods.retryLoad}
    />
  );
}
