/**
 * Cool blue-gray surfaces, slate-blue primary actions and color reserved for meaning
 * (macros, water, progress). See docs/redesign-2026-10.md.
 */
export const lightColors = {
  background: "#eef2f6",
  foreground: "#172029",
  card: "#ffffff",
  /** Raised surfaces that float above cards: menus, popovers, the tab bar. */
  elevated: "#ffffff",
  primary: "#2c5070",
  primaryForeground: "#ffffff",
  /** Kine blue: links, avatar and quiet highlights. */
  brand: "#3a6a96",
  brandSoft: "#e2ecf5",
  carbs: "#a4661a",
  protein: "#3a6a96",
  fat: "#b04e72",
  water: "#1f78a6",
  success: "#2f7d5b",
  secondary: "#e3e9ef",
  secondaryForeground: "#2c5070",
  muted: "#e6ecf1",
  mutedForeground: "#52606d",
  accent: "#d6e0e8",
  border: "#dde4ea",
  input: "#c9d3dc",
  ring: "#4f7fa6",
  destructive: "#b42318",
  destructiveForeground: "#ffffff",
  danger: "#b42318",
  /** Tinted fill behind red actions before they confirm. */
  dangerSoft: "#fbe8e6",
  error: "#991b1b",
  /** Card shadow color; dark mode relies on hairlines instead. */
  shadow: "rgba(30, 50, 70, 0.07)",
};

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  background: "#10161c",
  foreground: "#e8edf2",
  card: "#18212a",
  elevated: "#1f2a35",
  primary: "#94bdd7",
  primaryForeground: "#0f1820",
  brand: "#94bdd7",
  brandSoft: "#1e2e3d",
  carbs: "#e8ae55",
  protein: "#8db3dc",
  fat: "#e58aaa",
  water: "#62c0ea",
  success: "#6fc59c",
  secondary: "#232f3b",
  secondaryForeground: "#d7e6f2",
  muted: "#232f3b",
  mutedForeground: "#aab8c6",
  accent: "#2b3a48",
  border: "#2a3744",
  input: "#3b4a59",
  ring: "#94bdd7",
  destructive: "#f08a80",
  destructiveForeground: "#10181f",
  danger: "#fca5a5",
  dangerSoft: "#3a2224",
  error: "#fca5a5",
  shadow: "rgba(0, 0, 0, 0)",
};

export const radius = {
  /** Buttons, inputs and other controls. */
  control: 16,
  /** Cards and panels. */
  panel: 24,
  /** Small tiles and icon wells. */
  tile: 12,
  pill: 999,
};

export const spacing = {
  /** Gap between stacked cards and the default inner gap. */
  layout: 14,
  /** Screen edge gutter. */
  gutter: 20,
  /** Padding inside cards. */
  card: 18,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
};

/** Rounded Comfortaa sets display titles only; Manrope sets everything else with tabular figures. */
export const fonts = {
  display: "Comfortaa_600SemiBold",
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
};

/** Soft two-layer elevation for cards in light mode. */
export function cardShadow(colors: ThemeColors) {
  return colors.shadow === "rgba(0, 0, 0, 0)"
    ? undefined
    : `0px 1px 2px ${colors.shadow}, 0px 8px 24px ${colors.shadow}`;
}
