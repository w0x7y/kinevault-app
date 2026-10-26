import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import type glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome6Free.json";
import type ionGlyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json";
import type { TextProps } from "react-native";

export type IconName = keyof typeof glyphMap;

type IconProps = Omit<TextProps, "children"> & {
  name: IconName;
  size?: number;
  color?: string;
};

// Call sites name Font Awesome glyphs; the app draws the lighter Ionicons outline set.
// Names without an outline counterpart fall back to Font Awesome.
const outline: Partial<Record<IconName, keyof typeof ionGlyphMap>> = {
  "circle-exclamation": "alert-circle-outline",
  flag: "flag-outline",
  hourglass: "hourglass-outline",
  lock: "lock-closed-outline",
  "envelope-open-text": "mail-open-outline",
  map: "map-outline",
  person: "body-outline",
  "person-running": "walk-outline",
  "triangle-exclamation": "warning-outline",
  "apple-whole": "nutrition-outline",
  "arrow-left": "arrow-back",
  "arrow-right": "arrow-forward",
  barcode: "barcode-outline",
  bell: "notifications-outline",
  "bell-slash": "notifications-off-outline",
  calculator: "calculator-outline",
  calendar: "calendar-outline",
  camera: "camera-outline",
  "chart-line": "trending-up",
  "chart-pie": "pie-chart-outline",
  check: "checkmark",
  "chevron-down": "chevron-down",
  "chevron-left": "chevron-back",
  "chevron-right": "chevron-forward",
  "chevron-up": "chevron-up",
  "circle-plus": "add-circle-outline",
  "circle-question": "help-circle-outline",
  clapperboard: "film-outline",
  "clipboard-list": "clipboard-outline",
  cloud: "cloud-outline",
  comment: "chatbubble-outline",
  compass: "compass-outline",
  desktop: "desktop-outline",
  droplet: "water-outline",
  dumbbell: "barbell-outline",
  edit: "pencil-outline",
  egg: "egg-outline",
  envelope: "mail-outline",
  eye: "eye-outline",
  "eye-slash": "eye-off-outline",
  female: "female",
  "file-import": "download-outline",
  fire: "flame-outline",
  gear: "settings-outline",
  google: "logo-google",
  "glass-water": "pint-outline",
  heart: "heart-outline",
  home: "home-outline",
  house: "home-outline",
  image: "image-outline",
  images: "images-outline",
  key: "key-outline",
  link: "link-outline",
  list: "list-outline",
  "magnifying-glass": "search",
  male: "male",
  message: "chatbubbles-outline",
  minus: "remove",
  moon: "moon-outline",
  "mug-hot": "cafe-outline",
  "note-sticky": "document-text-outline",
  pen: "pencil-outline",
  play: "play",
  plus: "add",
  remove: "remove",
  "rotate-left": "refresh-outline",
  "rotate-right": "reload-outline",
  save: "save-outline",
  search: "search",
  seedling: "leaf-outline",
  "shoe-prints": "footsteps-outline",
  stop: "stop",
  sun: "sunny-outline",
  "trash-can": "trash-outline",
  trophy: "trophy-outline",
  user: "person-outline",
  "user-group": "people-outline",
  "user-pen": "pencil-outline",
  "user-shield": "shield-checkmark-outline",
  utensils: "restaurant-outline",
  weight: "scale-outline",
  "weight-scale": "scale-outline",
  "wheat-awn": "leaf-outline",
  xmark: "close",
  "file-export": "share-outline",
  "right-from-bracket": "log-out-outline",
  rotate: "sync-outline",
  "user-xmark": "person-remove-outline",
  "arrow-up": "arrow-up",
  ban: "ban-outline",
  ellipsis: "ellipsis-horizontal",
  "arrow-down": "arrow-down",
  "circle-check": "checkmark-circle-outline",
  "circle-info": "information-circle-outline",
  stopwatch: "timer-outline",
};

// Icons next to labels are decorative. Supply a label for a standalone icon.
export function Icon({ name, size = 20, color, accessibilityLabel, ...props }: IconProps) {
  const decorative = !accessibilityLabel;
  const shared = {
    ...props,
    size,
    color,
    accessible: !decorative,
    accessibilityLabel,
    accessibilityRole: decorative ? undefined : ("image" as const),
    accessibilityElementsHidden: decorative,
    importantForAccessibility: decorative ? ("no" as const) : ("auto" as const),
    "aria-hidden": decorative,
  };
  const mapped = outline[name];
  if (mapped) return <Ionicons {...shared} name={mapped} />;
  return <FontAwesome6 {...shared} name={name} solid />;
}
