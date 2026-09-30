import { Asset } from "expo-asset";
import { Image } from "expo-image";
import type { Step } from "../profile/answers";

export type KinePose = Step | "today" | "food" | "exercise" | "settings";

export const kineAssets: Record<KinePose, number> = {
  welcome: require("../../assets/mascot/2d/kine-welcome.webp"),
  name: require("../../assets/mascot/2d/kine-name.webp"),
  goal: require("../../assets/mascot/2d/kine-goal.webp"),
  body: require("../../assets/mascot/2d/kine-body.webp"),
  activity: require("../../assets/mascot/2d/kine-activity.webp"),
  calories: require("../../assets/mascot/2d/kine-calories.webp"),
  review: require("../../assets/mascot/2d/kine-review.webp"),
  today: require("../../assets/mascot/2d/kine-today.webp"),
  food: require("../../assets/mascot/2d/kine-food.webp"),
  exercise: require("../../assets/mascot/2d/kine-exercise.webp"),
  settings: require("../../assets/mascot/2d/kine-settings.webp"),
};

const upcoming: Record<KinePose, KinePose[]> = {
  welcome: ["name"],
  name: ["goal"],
  goal: ["body"],
  body: ["activity"],
  activity: ["calories"],
  calories: ["review"],
  review: ["today"],
  today: ["food", "exercise", "settings"],
  food: ["today", "exercise", "settings"],
  exercise: ["today", "food", "settings"],
  settings: ["today", "name"],
};
const warming = new Set<KinePose>();

// Called after the visible pose loads; background work never gates the screen.
export function warmUpcomingKine(pose: KinePose) {
  warming.add(pose);
  for (const next of upcoming[pose]) {
    if (warming.has(next)) continue;
    warming.add(next);
    const asset = Asset.fromModule(kineAssets[next]);
    void Image.prefetch(asset.localUri || asset.uri, "memory-disk")
      .then((loaded) => {
        if (!loaded) warming.delete(next);
      })
      .catch(() => warming.delete(next));
  }
}
