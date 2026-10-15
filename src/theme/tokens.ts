export const lightColors = {
  background: "#eef1f4",
  foreground: "#192026",
  card: "#ffffff",
  primary: "#314e65",
  primaryForeground: "#ffffff",
  carbs: "#96591b",
  protein: "#27689b",
  fat: "#7751a1",
  secondary: "#e2e8ee",
  secondaryForeground: "#314e65",
  muted: "#e9edf1",
  mutedForeground: "#52606d",
  accent: "#d6e0e8",
  border: "#ced6de",
  input: "#ced6de",
  ring: "#638ba6",
  destructive: "#b42318",
  destructiveForeground: "#ffffff",
  danger: "#b42318",
  error: "#991b1b",
};

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  background: "#12171d",
  foreground: "#e5eaf0",
  card: "#1a222b",
  primary: "#94bdd7",
  primaryForeground: "#10181f",
  carbs: "#e5b365",
  protein: "#79b7e8",
  fat: "#b69adc",
  secondary: "#25313d",
  secondaryForeground: "#d7e6f2",
  muted: "#25313d",
  mutedForeground: "#b0bdca",
  accent: "#253747",
  border: "#3b4a59",
  input: "#3b4a59",
  ring: "#94bdd7",
  destructive: "#f08a80",
  destructiveForeground: "#10181f",
  danger: "#fca5a5",
  error: "#fca5a5",
};

export const radius = {
  control: 14,
  panel: 18,
};
export const spacing = {
  layout: 12,
  xs: 4,
  sm: 8,
  md: 12,
};
/** Comfortaa sets titles and headings; Nunito sets everything else, and its figures are tabular. */
export const fonts = {
  display: "Comfortaa_600SemiBold",
  regular: "Nunito_400Regular",
  medium: "Nunito_500Medium",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
};
